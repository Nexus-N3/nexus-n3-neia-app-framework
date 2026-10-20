import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { ScreenLayout } from '../components/ScreenLayout';
import { SubjectsCarousel } from '../components/SubjectsCarousel';
import { BackButton } from '../components/BackButton';
import { BarGraph } from '../components/BarGraph';
import { configuredSubjectsAtom, selectedSubjectAtom, subjectCountAtom, subjectPrefixAtom } from '../store/atoms';
import { SegmentedControl } from '../components/SegmentedControl';
import chevronLeft from '../assets/chevron-left.svg';
import chevronRight from '../assets/chevron-right.svg';
import { useLatestComputeResults } from '../hooks/useLatestComputeResults';
import { useLatestIntermediateResults } from '../hooks/useLatestIntermediateResults';
import { isCompactFlowViewport } from '../utils/displayProfiles';
import { buildWorkflowSubjects } from '../utils/subjects';

interface BandValues {
  x: number | null;
  y: number | null;
  z: number | null;
  mag: number | null;
}

const HISTORY_WINDOW_SIZE = 5;

const locationPriority = (location: string) => {
  const normalized = location.toUpperCase();
  if (normalized.includes('LEFT')) return 0;
  if (normalized.includes('RIGHT')) return 1;
  return 2;
};

const getBandValues = (
  bands: Array<{ bandName: string; x: number | null; y: number | null; z: number | null; mag: number | null }>,
): BandValues | null => bands.find((band) => band.bandName === '0-6') ?? null;

const getIntensityValue = (
  bands: Array<{ bandName: string; x: number | null; y: number | null; z: number | null; mag: number | null }>,
) => getBandValues(bands)?.mag ?? null;

const formatLocationLabel = (location: string) => location.replace(/_/g, ' ');

const formatPercent = (value: number | null) => (value !== null ? `${value.toFixed(0)}%` : '-');
const formatSignedPercent = (value: number | null | undefined) =>
  typeof value === 'number' ? `${value.toFixed(0)}%` : '-';
const normalizeLocationKey = (value: string) => value.replace(/\s+/g, '_').toUpperCase();
const formatRatio = (left: number | null | undefined, right: number | null | undefined) =>
  typeof left === 'number' && typeof right === 'number' ? `${left.toFixed(4)}:${right.toFixed(4)}` : '-';

export const SubjectActivityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const subjectId = parseInt(id || '1', 10);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSubject] = useAtom(selectedSubjectAtom);
  const [viewMode, setViewMode] = useState<'realtime' | 'periodic'>('realtime');
  const isCompactViewport = isCompactFlowViewport();
  const [historyOffset, setHistoryOffset] = useState(0);
  const [prevSubjectId, setPrevSubjectId] = useState(subjectId);
  if (prevSubjectId !== subjectId) {
    setPrevSubjectId(subjectId);
    setHistoryOffset(0);
  }
  const { resultHistory } = useLatestComputeResults();
  const { latestIntermediateResults, latestIntermediateComparisons } = useLatestIntermediateResults();
  const workflowSubjects = buildWorkflowSubjects(subjectCount, subjectPrefix, configuredSubjects, selectedSubject);
  const subjectKey = workflowSubjects.find((subject) => subject.id === subjectId)?.name ?? `${subjectPrefix}${subjectId}`;
  const subjectHistory = resultHistory[subjectKey] ?? [];
  const periodicSensorResults = Object.values(latestIntermediateResults[subjectKey] ?? {}).sort(
    (a, b) => locationPriority(a.location) - locationPriority(b.location),
  );
  const periodicComparison = latestIntermediateComparisons[subjectKey]?.[0];
  const maxOffset = Math.max(subjectHistory.length - HISTORY_WINDOW_SIZE, 0);
  const windowStart = Math.max(subjectHistory.length - HISTORY_WINDOW_SIZE - historyOffset, 0);
  const windowEnd = subjectHistory.length - historyOffset;
  const visibleHistory = subjectHistory.slice(windowStart, windowEnd);

  const intensityTotals = subjectHistory.reduce<Record<string, { label: string; total: number; count: number }>>((acc, entry) => {
    entry.results.forEach((result) => {
      const value = getIntensityValue(result.bands);

      if (value === null) {
        return;
      }

      const key = result.location;
      const current = acc[key] ?? {
        label: formatLocationLabel(result.location),
        total: 0,
        count: 0,
      };

      acc[key] = {
        ...current,
        total: current.total + value,
        count: current.count + 1,
      };
    });

    return acc;
  }, {});

  const axisTotals = subjectHistory.reduce<
    Record<string, { label: string; xTotal: number; xCount: number; yTotal: number; yCount: number; zTotal: number; zCount: number }>
  >((acc, entry) => {
    entry.results.forEach((result) => {
      const bandValues = getBandValues(result.bands);

      if (!bandValues) {
        return;
      }

      const key = result.location;
      const current = acc[key] ?? {
        label: formatLocationLabel(result.location),
        xTotal: 0,
        xCount: 0,
        yTotal: 0,
        yCount: 0,
        zTotal: 0,
        zCount: 0,
      };

      acc[key] = {
        ...current,
        xTotal: current.xTotal + (bandValues.x ?? 0),
        xCount: current.xCount + (bandValues.x !== null ? 1 : 0),
        yTotal: current.yTotal + (bandValues.y ?? 0),
        yCount: current.yCount + (bandValues.y !== null ? 1 : 0),
        zTotal: current.zTotal + (bandValues.z ?? 0),
        zCount: current.zCount + (bandValues.z !== null ? 1 : 0),
      };
    });

    return acc;
  }, {});

  const averageIntensityValues = Object.entries(intensityTotals)
    .map(([location, aggregate]) => ({
      location,
      label: aggregate.label,
      value: aggregate.count > 0 ? aggregate.total / aggregate.count : null,
    }))
    .sort((a, b) => locationPriority(a.location) - locationPriority(b.location));

  const leftAverage = averageIntensityValues.find((result) => result.location.toUpperCase().includes('LEFT'))?.value ?? null;
  const rightAverage = averageIntensityValues.find((result) => result.location.toUpperCase().includes('RIGHT'))?.value ?? null;
  const totalAverage = (leftAverage ?? 0) + (rightAverage ?? 0);
  const leftPercent = totalAverage > 0 && leftAverage !== null ? (leftAverage / totalAverage) * 100 : null;
  const rightPercent = totalAverage > 0 && rightAverage !== null ? (rightAverage / totalAverage) * 100 : null;
  const offload = leftPercent !== null && rightPercent !== null ? Math.abs(rightPercent - leftPercent) : null;
  const dominanceLabel =
    leftPercent === null || rightPercent === null || leftPercent === rightPercent
      ? 'Balanced'
      : leftPercent > rightPercent
      ? 'Left Side Dominant'
      : 'Right Side Dominant';
  const averageAxisValues = Object.entries(axisTotals)
    .map(([location, aggregate]) => ({
      location,
      label: aggregate.label,
      x: aggregate.xCount > 0 ? aggregate.xTotal / aggregate.xCount : null,
      y: aggregate.yCount > 0 ? aggregate.yTotal / aggregate.yCount : null,
      z: aggregate.zCount > 0 ? aggregate.zTotal / aggregate.zCount : null,
    }))
    .sort((a, b) => locationPriority(a.location) - locationPriority(b.location));
  const leftAxisAverages = averageAxisValues.find((result) => result.location.toUpperCase().includes('LEFT'));
  const rightAxisAverages = averageAxisValues.find((result) => result.location.toUpperCase().includes('RIGHT'));
  const leftAxisTotal =
    (leftAxisAverages?.x ?? 0) + (leftAxisAverages?.y ?? 0) + (leftAxisAverages?.z ?? 0);
  const rightAxisTotal =
    (rightAxisAverages?.x ?? 0) + (rightAxisAverages?.y ?? 0) + (rightAxisAverages?.z ?? 0);
  const movementCompensations = [
    {
      axis: 'V',
      left: leftAxisTotal > 0 && leftAxisAverages?.x !== null && leftAxisAverages?.x !== undefined
        ? (leftAxisAverages.x / leftAxisTotal) * 100
        : null,
      right: rightAxisTotal > 0 && rightAxisAverages?.x !== null && rightAxisAverages?.x !== undefined
        ? (rightAxisAverages.x / rightAxisTotal) * 100
        : null,
    },
    {
      axis: 'ML',
      left: leftAxisTotal > 0 && leftAxisAverages?.y !== null && leftAxisAverages?.y !== undefined
        ? (leftAxisAverages.y / leftAxisTotal) * 100
        : null,
      right: rightAxisTotal > 0 && rightAxisAverages?.y !== null && rightAxisAverages?.y !== undefined
        ? (rightAxisAverages.y / rightAxisTotal) * 100
        : null,
    },
    {
      axis: 'AP',
      left: leftAxisTotal > 0 && leftAxisAverages?.z !== null && leftAxisAverages?.z !== undefined
        ? (leftAxisAverages.z / leftAxisTotal) * 100
        : null,
      right: rightAxisTotal > 0 && rightAxisAverages?.z !== null && rightAxisAverages?.z !== undefined
        ? (rightAxisAverages.z / rightAxisTotal) * 100
        : null,
    },
  ];

  if (historyOffset > maxOffset) {
    setHistoryOffset(maxOffset);
  }

  const chartSeries = visibleHistory.map((entry) => {
    const sortedResults = [...entry.results].sort((a, b) => locationPriority(a.location) - locationPriority(b.location));
    const [leftResult, rightResult] = sortedResults;

    return {
      timestamp: entry.timestamp,
      resultCount: entry.resultCount,
      leftLocation: leftResult ? formatLocationLabel(leftResult.location) : 'Left ankle',
      rightLocation: rightResult ? formatLocationLabel(rightResult.location) : 'Right ankle',
      leftValue: getIntensityValue(leftResult?.bands ?? []),
      rightValue: getIntensityValue(rightResult?.bands ?? []),
    };
  }).filter((entry) => entry.leftValue !== null || entry.rightValue !== null);

  const maxVisibleValue = Math.max(
    ...chartSeries.flatMap((entry) => [entry.leftValue ?? 0, entry.rightValue ?? 0]),
    1,
  );
  const chartData = chartSeries.map((entry) => ({
    l: `${((Math.max(entry.leftValue ?? 0, 0) / maxVisibleValue) * 100).toFixed(0)}%`,
    r: `${((Math.max(entry.rightValue ?? 0, 0) / maxVisibleValue) * 100).toFixed(0)}%`,
  }));
  const chartLabels = chartSeries.map((entry) => entry.resultCount.toString());
  const leftLocationLabel = chartSeries.find((entry) => entry.leftValue !== null)?.leftLocation ?? 'Left ankle';
  const rightLocationLabel = chartSeries.find((entry) => entry.rightValue !== null)?.rightLocation ?? 'Right ankle';
  const periodicSensorSummaries = periodicSensorResults.map((result) => {
    const band = getBandValues(result.bands);

    return {
      address: result.address,
      location: formatLocationLabel(result.location),
      intensity: band?.mag ?? null,
      v: band?.x ?? null,
      ml: band?.y ?? null,
      ap: band?.z ?? null,
    };
  });
  const periodicComparisonBand = periodicComparison?.data['0-6'];
  const periodicComparisonTitle = periodicComparison?.pair
    ? `${periodicComparison.pair[0].replace(/_/g, ' ')} vs ${periodicComparison.pair[1].replace(/_/g, ' ')}`
    : 'Comparison';
  const periodicLeftSensor = periodicComparison?.pair?.[0]
    ? periodicSensorSummaries.find((sensor) => normalizeLocationKey(sensor.location) === normalizeLocationKey(periodicComparison.pair[0]))
    : periodicSensorSummaries.find((sensor) => normalizeLocationKey(sensor.location).includes('LEFT'));
  const periodicRightSensor = periodicComparison?.pair?.[1]
    ? periodicSensorSummaries.find((sensor) => normalizeLocationKey(sensor.location) === normalizeLocationKey(periodicComparison.pair[1]))
    : periodicSensorSummaries.find((sensor) => normalizeLocationKey(sensor.location).includes('RIGHT'));
  const periodicRatioLabel =
    periodicLeftSensor && periodicRightSensor
      ? `${periodicLeftSensor.location}:${periodicRightSensor.location}`
      : periodicComparison?.pair
      ? `${periodicComparison.pair[0].replace(/_/g, ' ')}:${periodicComparison.pair[1].replace(/_/g, ' ')}`
      : 'Left:Right';

  const handleBack = () => {
    navigate('/active-session');
  };

  return (
    <ScreenLayout>
      <div className="sub-header-row subject-activity-header">
        <div className="subject-header-left">
          <BackButton onClick={handleBack} />
        </div>

        <div className="subject-header-center">
          <SubjectsCarousel
            title={subjectKey}
            currentPage={subjectId - 1}
            totalPages={subjectCount}
            onPrev={() => navigate(`/activity/subject/${subjectId - 1}`)}
            onNext={() => navigate(`/activity/subject/${subjectId + 1}`)}
          />
        </div>

        <div className="subject-header-right">
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as 'realtime' | 'periodic')}
            options={[
              { label: isCompactViewport ? 'Live' : 'Real time', value: 'realtime' },
              { label: 'Periodic', value: 'periodic' },
            ]}
          />
        </div>
      </div>

      {viewMode === 'periodic' ? (
        <div className="subject-content-grid periodic-subject-grid">
          <div className="metric-panel">
            <h3 className="performance-header">Sensor Summary</h3>
            <div className="performance-subtitle">Intermediate 0-6 band</div>

            <div className="text-white">
              {periodicSensorSummaries.length > 0 ? (
                periodicSensorSummaries.map((sensor) => (
                  <div key={sensor.address} className="metric-container">
                    <h4 className="metric-title">{sensor.location}</h4>
                    <hr className="metric-separator" />
                    <div className="periodic-intensity-block">
                      <div className="metric-cell periodic-intensity-cell">
                        <span className="metric-label">INTENSITY</span>
                        <span className="metric-value-large text-primary mt-4">
                          {sensor.intensity !== null ? sensor.intensity.toFixed(4) : '-'} <span className="metric-unit">bw/s</span>
                        </span>
                      </div>
                      <div className="periodic-axes-row">
                        <div className="metric-cell">
                          <span className="metric-label">V</span>
                          <span className="metric-value-large text-primary mt-4">
                            {sensor.v !== null ? sensor.v.toFixed(4) : '-'}
                          </span>
                        </div>
                        <div className="metric-cell">
                          <span className="metric-label">ML</span>
                          <span className="metric-value-large text-primary mt-4">
                            {sensor.ml !== null ? sensor.ml.toFixed(4) : '-'}
                          </span>
                        </div>
                        <div className="metric-cell">
                          <span className="metric-label">AP</span>
                          <span className="metric-value-large text-primary mt-4">
                            {sensor.ap !== null ? sensor.ap.toFixed(4) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="subject-history-empty">Waiting for intermediate results...</div>
              )}
            </div>
          </div>

          <div className="metric-panel">
            <h3 className="performance-header">Comparison Summary</h3>
            <div className="performance-subtitle">{periodicComparisonTitle}</div>

            <div className="text-white">
              <div className="metric-container">
                <h4 className="metric-title">0-6 BAND DIFFERENCE</h4>
                <hr className="metric-separator" />
                {periodicComparisonBand ? (
                  <div className="periodic-intensity-block">
                      <div className="metric-cell periodic-intensity-cell">
                        <span className="metric-label">INTENSITY</span>
                        <span className="metric-value-large text-secondary mt-4">
                          {formatSignedPercent(periodicComparisonBand.mag)}
                        </span>
                        <span className="metric-ratio-text">
                          <span className="metric-ratio-label">{periodicRatioLabel}</span>
                          <span className="metric-ratio-value">
                            {formatRatio(periodicLeftSensor?.intensity, periodicRightSensor?.intensity)}
                          </span>
                        </span>
                      </div>
                      <div className="periodic-axes-row">
                        <div className="metric-cell">
                          <span className="metric-label">V</span>
                          <span className="metric-value-large text-secondary mt-4">
                            {formatSignedPercent(periodicComparisonBand.x)}
                          </span>
                          <span className="metric-ratio-text">
                            <span className="metric-ratio-label">{periodicRatioLabel}</span>
                            <span className="metric-ratio-value">
                              {formatRatio(periodicLeftSensor?.v, periodicRightSensor?.v)}
                            </span>
                          </span>
                        </div>
                        <div className="metric-cell">
                          <span className="metric-label">ML</span>
                          <span className="metric-value-large text-secondary mt-4">
                            {formatSignedPercent(periodicComparisonBand.y)}
                          </span>
                          <span className="metric-ratio-text">
                            <span className="metric-ratio-label">{periodicRatioLabel}</span>
                            <span className="metric-ratio-value">
                              {formatRatio(periodicLeftSensor?.ml, periodicRightSensor?.ml)}
                            </span>
                          </span>
                        </div>
                        <div className="metric-cell">
                          <span className="metric-label">AP</span>
                          <span className="metric-value-large text-secondary mt-4">
                            {formatSignedPercent(periodicComparisonBand.z)}
                          </span>
                          <span className="metric-ratio-text">
                            <span className="metric-ratio-label">{periodicRatioLabel}</span>
                            <span className="metric-ratio-value">
                              {formatRatio(periodicLeftSensor?.ap, periodicRightSensor?.ap)}
                            </span>
                          </span>
                        </div>
                      </div>
                  </div>
                ) : (
                  <div className="subject-history-empty">Waiting for comparison data...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="subject-content-grid">
        <div className="metric-panel">
          <h3 className="performance-header">Performance</h3>
          <div className="performance-subtitle">Running averages</div>

          <div className="text-white">
            <div className="metric-container">
              <h4 className="metric-title">LOADING</h4>
              <hr className="metric-separator" />
              <div className="metric-grid subject-loading-grid">
                {averageIntensityValues.length > 0 ? (
                  averageIntensityValues.map((result) => (
                    <div key={result.location} className="metric-cell">
                      <span className="metric-label">{result.label}</span>
                      <span className="metric-value-large text-primary mt-4">
                        {result.value !== null ? result.value.toFixed(4) : '-'} <span className="metric-unit">bw/s</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="subject-history-empty">Waiting for compute results...</div>
                )}
              </div>
            </div>

            <div className="metric-container">
              <h4 className="metric-title">IMBALANCE</h4>
              <hr className="metric-separator" />
              <div className="metric-subtitle">{dominanceLabel}</div>
              <div className="metric-grid">
                <div className="metric-cell">
                  <span className="metric-label">OFFLOAD</span>
                  <span className="metric-value-large text-primary font-semibold mt-4">{formatPercent(offload)}</span>
                </div>
                <div className="metric-cell">
                  <span className="metric-label">RATIO</span>
                  <span className="metric-value-large font-medium mt-4">
                    <span className="text-primary">{leftPercent !== null ? leftPercent.toFixed(0) : '-'}</span>
                    <span className="separator-ratio">:</span>
                    <span className="text-secondary">{rightPercent !== null ? rightPercent.toFixed(0) : '-'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="metric-title">MOVEMENT COMPENSATIONS (%)</h4>
              <hr className="metric-separator" />
              <div className="metric-col">
                {movementCompensations.map((row) => (
                  <div key={row.axis} className="movement-row">
                    <span className="metric-value-medium text-primary font-medium">
                      {row.left !== null ? row.left.toFixed(0) : '-'}
                    </span>
                    <span className="metric-unit-medium">{row.axis}</span>
                    <span className="metric-value-medium text-secondary font-medium">
                      {row.right !== null ? row.right.toFixed(0) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="graph-panel-column">
          <div className="graph-panel">
            <div className="graph-wrapper">
              <BarGraph
                variant="detailed"
                data={chartData}
                labels={chartLabels}
                leftLabel={leftLocationLabel}
                rightLabel={rightLocationLabel}
                topLabel={`${maxVisibleValue.toFixed(2)} BW/s`}
                midLabel={(maxVisibleValue / 2).toFixed(2)}
              />
            </div>

            <div className="nexus-time-control">
              <button
                className="time-control-btn spacing-right"
                aria-label="Previous Fast"
                onClick={() => setHistoryOffset((prev) => Math.min(prev + HISTORY_WINDOW_SIZE, maxOffset))}
                disabled={historyOffset >= maxOffset}
              >
                <div className="time-control-double-icon double-prev">
                  <img src={chevronLeft} alt="" className="time-control-icon" />
                  <img src={chevronLeft} alt="" className="time-control-icon" />
                </div>
              </button>
              <button
                className="time-control-btn"
                aria-label="Previous"
                onClick={() => setHistoryOffset((prev) => Math.min(prev + 1, maxOffset))}
                disabled={historyOffset >= maxOffset}
              >
                <img src={chevronLeft} alt="" className="time-control-icon" />
              </button>

              <span className="time-control-label">
                {visibleHistory.length > 0 ? `${windowStart + 1}-${windowEnd} of ${subjectHistory.length}` : 'No results yet'}
              </span>

              <button
                className="time-control-btn"
                aria-label="Next"
                onClick={() => setHistoryOffset((prev) => Math.max(prev - 1, 0))}
                disabled={historyOffset === 0}
              >
                <img src={chevronRight} alt="" className="time-control-icon" />
              </button>
              <button
                className="time-control-btn spacing-left"
                aria-label="Next Fast"
                onClick={() => setHistoryOffset((prev) => Math.max(prev - HISTORY_WINDOW_SIZE, 0))}
                disabled={historyOffset === 0}
              >
                <div className="time-control-double-icon double-next">
                  <img src={chevronRight} alt="" className="time-control-icon" />
                  <img src={chevronRight} alt="" className="time-control-icon" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

    </ScreenLayout>
  );
};
