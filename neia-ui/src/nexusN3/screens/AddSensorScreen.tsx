import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy route retained for bookmarked links. Sensor rows are now created and
 * edited in the subject-owned configuration view.
 */
export const AddSensorScreen: React.FC = () => <Navigate to="/sensor-setup" replace />;
