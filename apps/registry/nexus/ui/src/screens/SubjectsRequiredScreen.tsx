import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { subjectCountAtom } from '../store/atoms';

export const SubjectsRequiredScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount, setSubjectCount] = useAtom(subjectCountAtom);

  const increment = () => setSubjectCount((prev) => prev + 1);
  const decrement = () => setSubjectCount((prev) => (prev > 1 ? prev - 1 : 1));

  const handleBack = () => {
    navigate('/new-session');
  };

  const handleContinue = () => {
    navigate('/sensor-setup');
  };

  return (
    <main className="nexus-content subjects-required-content">
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />

        <h2 className="screen-title">SUBJECTS REQUIRED</h2>

        <InfoButton />
      </div>

      <div className="subject-counter-container">
        <button className="counter-btn" onClick={decrement}>
          -
        </button>
        <span className="counter-value" style={{ width: '3ch', display: 'inline-block', textAlign: 'center' }}>
          {subjectCount}
        </span>
        <button className="counter-btn" onClick={increment}>
          +
        </button>
      </div>

      <div className="session-form-container">
        <div className="form-group">
          <label>Subject naming convention</label>
          <input type="text" placeholder="(Default) Subject_[1]" className="nexus-input" />
          <span className="input-hint">Individual subject names can be edited once created</span>
        </div>
      </div>

      <div className="content-spacer"></div>

      <button className="nexus-btn continue-btn" onClick={handleContinue}>
        Continue to sensor requirements
      </button>
    </main>
  );
};
