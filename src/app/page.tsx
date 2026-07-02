import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>CalmingBeats Survey Site</h1>
        <p className="muted">
          This app is intended to be opened from iOS WKWebView or browser email links via <code>/start</code>.
        </p>
      </div>

      <div className="card">
        <h2>Survey Routes</h2>
        <ul>
          <li>
            <Link href="/survey/day-7">Day 7</Link>
          </li>
          <li>
            <Link href="/survey/day-14">Day 14</Link>
          </li>
          <li>
            <Link href="/survey/day-21">Day 21</Link>
          </li>
          <li>
            <Link href="/survey/nightly-recap">Nightly Recap</Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
