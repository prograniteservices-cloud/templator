"use client";

import BlueprintVisualization from './BlueprintVisualization';

const testData = {
  edges: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 }
  ],
  dimensions: { width: 100, height: 50 },
  scale: 1.0
};

export default function TestComponent() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Blueprint Visualization Test</h2>
      <BlueprintVisualization blueprintData={testData} />
    </div>
  );
}