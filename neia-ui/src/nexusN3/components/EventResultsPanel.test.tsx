import { fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { sessionEventsAtom } from '../store/atoms';
import { normalizeSessionEvent } from '../sessionEvents';
import { EventResultsPanel } from './EventResultsPanel';

const buildEvents = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    normalizeSessionEvent({
      type: index % 2 === 0 ? 'compute_result' : 'diagnostic_event',
      payload: {
        subject_id: 'subject-1',
        address: `sensor-${index}`,
        value: index,
      },
    }, index + 1, new Date(2026, 0, 1, 0, 0, index)),
  );

describe('EventResultsPanel', () => {
  it('renders latest-first pages, combined filters, and expandable payloads', () => {
    const store = createStore();
    store.set(sessionEventsAtom, buildEvents(25));
    render(
      <Provider store={store}>
        <EventResultsPanel completed={false} />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Event page 2' })).toBeVisible();
    expect(screen.getByText('sensor-24')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'diagnostic' } });
    expect(screen.getByText('12 events')).toBeVisible();

    fireEvent.click(screen.getAllByText('diagnostic_event')[0]);
    expect(screen.getByText(/"value": 23/)).toBeVisible();
  });

  it('keeps an older page stable when a new event arrives', () => {
    const store = createStore();
    const initial = buildEvents(25);
    store.set(sessionEventsAtom, initial);
    render(
      <Provider store={store}>
        <EventResultsPanel completed />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Event page 2' }));
    expect(screen.getByText('sensor-4')).toBeVisible();

    store.set(sessionEventsAtom, [
      ...initial,
      normalizeSessionEvent({ type: 'system_event', payload: { address: 'new-sensor' } }, 26),
    ]);

    expect(screen.getByText('sensor-4')).toBeVisible();
    expect(screen.queryByText('new-sensor')).not.toBeInTheDocument();
  });

  it('retains the same event history when transitioning to completed results', () => {
    const store = createStore();
    store.set(sessionEventsAtom, buildEvents(2));
    const view = render(
      <Provider store={store}>
        <EventResultsPanel completed={false} />
      </Provider>,
    );
    expect(screen.getByRole('region', { name: 'Live session events' })).toBeInTheDocument();

    view.rerender(
      <Provider store={store}>
        <EventResultsPanel completed />
      </Provider>,
    );

    expect(screen.getByRole('region', { name: 'Completed session events' })).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeVisible();
    expect(screen.getByText('sensor-1')).toBeVisible();
  });
});
