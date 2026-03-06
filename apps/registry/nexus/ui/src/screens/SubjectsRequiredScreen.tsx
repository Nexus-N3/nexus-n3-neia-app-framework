import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { subjectCountAtom, subjectPrefixAtom } from '../store/atoms';

export const SubjectsRequiredScreen: React.FC = () => {
  const navigate = useNavigate();
  const [subjectCount, setSubjectCount] = useAtom(subjectCountAtom);
  const [subjectPrefix, setSubjectPrefix] = useAtom(subjectPrefixAtom);

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
          <svg width="60" height="10" viewBox="0 0 60 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="60" height="10" rx="5" fill="currentColor" />
          </svg>
        </button>
        <span className="counter-value fixed-width-counter">
          {subjectCount}
        </span>
        <button className="counter-btn" onClick={increment}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M25 35V60H35V35H60V25H35V0H25V25H0V35H25Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className="form-container">
        <div className="form-group">
          <label>Subject naming convention</label>
          <input
            type="text"
            placeholder="(Default) Subject_[1]"
            className="nexus-input"
            value={subjectPrefix}
            onChange={(e) => setSubjectPrefix(e.target.value)}
          />
          <span className="input-hint">
            Individual subject names can be edited once created. Example: {subjectPrefix || 'Subject_'}[1]
          </span>
        </div>
      </div>

      <div className="screen-footer">
        <button className="nexus-btn continue-btn" onClick={handleContinue}>
          Continue to sensor requirements
        </button>
      </div>
    </main>
  );
};
