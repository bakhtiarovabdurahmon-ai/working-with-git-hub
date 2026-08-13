export default function Stars({ rating }) {
  const full = Math.round(rating);
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star ${i <= full ? 'filled' : ''}`}>★</span>
      ))}
    </>
  );
}
