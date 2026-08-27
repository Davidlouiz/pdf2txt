export default function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-bar">
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}
