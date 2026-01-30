// Dashboard.tsx
import { useEffect, useState } from "react";
import * as d3 from "d3";
import "./dashboard.css";
import ScatterTrend from "./figures/ScatterTrend";
import StreamGraph from "./figures/StreamGraph";
import BarChart from "./figures/BarChart";

export type Track = {
	track_popularity: number;
	artist_popularity: number;
	artist_followers: number;
	release_year: number;
	genre: string;
	danceability: number;
	energy: number;
	valence: number;
	tempo: number;
	duration_ms: number;
	explicit: number;
};

function normalizeGenre(raw: string): string {
	if (!raw) return "Other";
	const g = raw.toLowerCase();

	if (g.includes("pop")) return "pop";
	if (g.includes("rap") || g.includes("hip")) return "rap";
	if (g.includes("edm") || g.includes("electronic")) return "edm";
	if (g.includes("country")) return "country";
	if (g.includes("soundtrack")) return "soundtrack";
	if (g.includes("r&b") || g.includes("rnb")) return "dark r&b";
	if (g.includes("art")) return "art pop";
	if (g.includes("soft")) return "soft pop";

	return "Other";
}

export default function Dashboard() {
	const [data, setData] = useState<Track[] | null>(null);

	// Load data ONCE
	useEffect(() => {
		d3.csv("/data/track_data_final.csv").then(raw => {
			const parsed: Track[] = raw.map(d => ({
				track_popularity: +d.track_popularity!,
				artist_popularity: +d.artist_popularity!,
				artist_followers: +d.artist_followers!,
				release_year: new Date(d.album_release_date!).getFullYear(),
				genre: normalizeGenre(d.artist_genres),
				danceability: +d.danceability!,
				energy: +d.energy!,
				valence: +d.valence!,
				tempo: +d.tempo!,
				duration_ms: +d.duration_ms!,
				explicit: +d.explicit!
			}));

			setData(parsed);
		});
	}, []);

	if (!data) {
		return <div style={{ padding: "20px" }}>Loading data…</div>;
	}

	return (
		<div className="page">
		<h2 className="dashboard-title">
			Genre, Popularity, and Temporal Structure in Contemporary Music
			<span className="dashboard-title-sub">
				How Genre and Artist Visibility Shape Track Popularity Over Time
			</span>
		</h2>

		<div className="dashboard-subtitle">
			<div className="figure-guide">
				<strong>Figure guide.</strong>
				<span>
					<strong>(Top)</strong> Stream graph — year-by-year genre composition.
					<em> Area thickness</em> encodes relative genre prevalence within each year (wiggle-offset for readability).
				</span>
				<span>
					<br></br>
					<strong>(Bottom-left)</strong> Scatter + trend lines — association between artist popularity and track popularity.
					<em> Point size</em> = artist followers; <em>color</em> = genre; <em>lines</em> = per-genre least-squares fit.
				</span>
				<span>
					<br></br>
					<strong>(Bottom-right)</strong> Bar chart — baseline track popularity by genre.
					<em> Bar height</em> = mean popularity; <em>error bar (variability)</em> = ±1 standard deviation.
				</span>
			</div>

			<div className="figure-goal">
				<br></br>
				<strong>Objective:</strong> Does genre context and artist popularity jointly structure track popularity,
				and whether genres differ in baseline popularity and variability.
			</div>
		</div>


			<div className="dashboard">
				<div className="top-row">
					<div className="panel">
						<h3>Stream Graph: Genre Composition Over Time</h3>
						{/* Temporal aggregate view showing relative genre prevalence over release years */}
						<StreamGraph data={data} />
					</div>
				</div>

				<div className="bottom-row">
					<div className="panel">
						<h3>Scatter Plot: Track Popularity vs Artist Popularity</h3>
						{/* Position encoding for quantitative comparison;
							(color used for categorical genre separation) */}
						<ScatterTrend data={data} />
					</div>

					<div className="panel">
						<h3>Mean Track Popularity by Genre</h3>
						{/* baseline differences in track popularity across genres, providing context for the genre */}
						<BarChart data={data} />
					</div>
				</div>
			</div>
		</div>
	);
}