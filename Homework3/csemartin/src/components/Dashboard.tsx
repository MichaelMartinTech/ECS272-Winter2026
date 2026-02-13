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
	danceability: number;
	energy: number;
	valence: number;
	tempo: number;
	duration_ms: number;
	explicit: boolean;
	// Added
	genre: string;
	rawGenres?: string;
	artist_name: string;
	track_name: string;
};

type AxisOption =
	| "artist_followers"
	| "artist_popularity"
	| "track_popularity"
	| "release_year";

/*
function normalizeGenre(raw: string): string {
	if (!raw) return "Other";
	const g = raw.toLowerCase();

	if (g.includes("pop")) return "pop"; // k-pop, j-pop, etc are collapsed, and empty strings become "other"
	if (g.includes("rap") || g.includes("hip")) return "rap";
	if (g.includes("edm") || g.includes("electronic")) return "edm";
	if (g.includes("country")) return "country";
	if (g.includes("soundtrack")) return "soundtrack";
	if (g.includes("r&b") || g.includes("rnb")) return "dark r&b";
	if (g.includes("art")) return "art pop";
	if (g.includes("soft")) return "soft pop";

	return "Other";
}
*/

// Genre families
function normalizeGenre(raw: string): string {
	if (!raw) return "Other";
	const g = raw.toLowerCase();

	// --- POP FAMILY ---
	if (
		g.includes("k-pop") ||
		g.includes("j-pop") ||
		g.includes("dance pop") ||
		g.includes("electropop") ||
		g.includes("teen pop") ||
		g.includes("indie pop") ||
		g.includes("dream pop") ||
		g === "pop" ||
		g.includes(" pop")
	) return "Pop";

	// --- HIP-HOP / RAP ---
	if (
		g.includes("trap") ||
		g.includes("rap") ||
		g.includes("hip")
	) return "Hip-Hop / Rap";

	// --- ROCK / ALTERNATIVE ---
	if (
		g.includes("alternative") ||
		g.includes("indie rock") ||
		g.includes("modern rock") ||
		g.includes("grunge") ||
		g.includes("metal") ||
		g.includes("rock")
	) return "Rock / Alternative";

	// --- ELECTRONIC / EDM ---
	if (
		g.includes("house") ||
		g.includes("techno") ||
		g.includes("dubstep") ||
		g.includes("trance") ||
		g.includes("electronic") ||
		g.includes("edm")
	) return "Electronic / EDM";

	// --- R&B / SOUL ---
	if (
		g.includes("neo soul") ||
		g.includes("r&b") ||
		g.includes("rnb") ||
		g.includes("soul")
	) return "R&B / Soul";

	// --- LATIN ---
	if (
		g.includes("reggaeton") ||
		g.includes("latin")
	) return "Latin";

	// --- COUNTRY / FOLK ---
	if (
		g.includes("contemporary country") ||
		g.includes("country") ||
		g.includes("folk")
	) return "Country / Folk";

	// --- JAZZ / GOSPEL ---
	if (
		g.includes("jazz") ||
		g.includes("gospel")
	) return "Jazz / Gospel";

	// --- SOUNDTRACK ---
	if (
		g.includes("soundtrack") ||
		g.includes("score")
	) return "Soundtrack";

	return "Other";
}


export default function Dashboard() {
	const [data, setData] = useState<Track[] | null>(null);

	// Shared interaction state (HW3 coordinated filtering)
	const [visibleYearRange, setVisibleYearRange] =
		useState<[number, number] | null>(null);

	const [linkBarToStream, setLinkBarToStream] =
		useState<boolean>(true);

	const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
	const [showArtistPoints, setShowArtistPoints] = useState<boolean>(true);
	const [showArtistLines, setShowArtistLines] = useState<boolean>(false);

	// Axis selection state
	const [xAxisField, setXAxisField] =
		useState<AxisOption>("artist_popularity");

	const [yAxisField, setYAxisField] =
		useState<AxisOption>("track_popularity");

	const [sizeField, setSizeField] =
		useState<AxisOption>("artist_followers");

	const [showSettings, setShowSettings] =
		useState<boolean>(false);


	// Load data ONCE
	useEffect(() => {
		//d3.csv("/data/track_data_final.csv").then(raw => {
		Promise.all([
			d3.csv("/data/track_data_final.csv"),
			d3.csv("/data/spotify_data_clean.csv")
		]).then(([trackRaw, cleanRaw]) => {
			// Build lookup from clean dataset
			const cleanGenreMap = new Map<string, string>();

			cleanRaw.forEach(d => {
				const artist = d.artist_name?.trim();
				const genres = d.artist_genres?.trim();

				if (artist && genres) {
					cleanGenreMap.set(artist.toLowerCase(), genres);
				}
			});

			//const parsed: Track[] = raw.map(d => ({
			const parsed: Track[] = trackRaw.map(d => {

				// Primary genre from track_data_final
				let rawGenre = (d.artist_genres || "").trim();

				// Treat invalid placeholders as empty so fallback can happen
				if (
					rawGenre === "" ||
					rawGenre === "[]" ||
					rawGenre === "[ ]" ||
					rawGenre.toLowerCase() === "null"
				) {
					rawGenre = "";
				}

				// Fallback to clean dataset if empty
				if (!rawGenre || rawGenre.trim() === "") {
					const fallback = cleanGenreMap.get(d.artist_name?.toLowerCase() || "");
					if (fallback) rawGenre = fallback;
				}

				// Remove brackets if list-style string
				rawGenre = rawGenre.replace(/[\[\]']/g, "");

				// Split by comma and take first token
				const genreTokens = rawGenre
					.split(",")
					.map(s => s.trim())
					.filter(Boolean);

				// Try to classify using family precedence (not token order)
				let classified = "Other";

				// Define precedence order (modern --> legacy)
				const familyPrecedence = [
					"Pop",
					"Hip-Hop / Rap",
					"Rock / Alternative",
					"Electronic / EDM",
					"R&B / Soul",
					"Latin",
					"Country / Folk",
					"Jazz / Gospel",
					"Soundtrack"
				];

				// Collect ALL candidate families present
				const candidateFamilies = new Set<string>();

				for (const token of genreTokens) {
					const fam = normalizeGenre(token);
					if (fam !== "Other") {
						candidateFamilies.add(fam);
					}
				}

				// Apply precedence AFTER collecting
				for (const family of familyPrecedence) {
					if (candidateFamilies.has(family)) {
						classified = family;
						break;
					}
				}

				let durationRaw = +d.track_duration_ms!;

				if (durationRaw > 0 && durationRaw < 1000) {
					durationRaw = durationRaw * 60 * 1000;
				}

				let parsedYear = new Date(d.album_release_date ?? "").getFullYear();

				if (!Number.isFinite(parsedYear) || parsedYear < 1900 || parsedYear > 2025) {
					parsedYear = NaN;
				}
				

				return {
					track_popularity: +d.track_popularity!,
					artist_popularity: +d.artist_popularity!,
					artist_followers: +d.artist_followers!,
					release_year: parsedYear, //release_year: new Date(d.album_release_date!).getFullYear(),
					//genre: normalizeGenre(primaryGenre),
					//genre: classified,
					danceability: +d.danceability!,
					energy: +d.energy!,
					valence: +d.valence!,
					tempo: +d.tempo!,
					//duration_ms: +d.duration_ms!,
					duration_ms: durationRaw,
					explicit: String(d.explicit).toLowerCase() === "true",
					genre: classified,
					rawGenres: rawGenre,
					artist_name: d.artist_name?.trim() || "",
					track_name: d.track_name?.trim() || ""
				};
			});

			setData(parsed);
			
		});
	}, []);

	if (!data) {
		return <div style={{ padding: "20px" }}>Loading data…</div>;
	}

	const axisOptions: AxisOption[] = [
		"artist_followers",
		"artist_popularity",
		"track_popularity",
		"release_year"
	];

	function formatAxisLabel(field: AxisOption) {
		switch (field) {
			case "artist_followers": return "Artist Followers";
			case "artist_popularity": return "Artist Popularity";
			case "track_popularity": return "Track Popularity";
			case "release_year": return "Release Year";
		}
	}

	function renderDropdown(
		label: string,
		value: AxisOption,
		setter: (v: AxisOption) => void
	) {
		return (
			<div style={{ marginBottom: "6px" }}>
				<label>{label}</label>
				<select
					value={value}
					onChange={(e) => {
						const newVal = e.target.value as AxisOption;

						// Enforce distinct axes
						const chosen = [xAxisField, yAxisField, sizeField];
						const duplicates = chosen.filter(v => v === newVal);

						if (duplicates.length >= 1 && newVal !== value) return;

						setter(newVal);
					}}
					style={{ marginLeft: "6px", fontSize: "11px" }}
				>
					{axisOptions.map(opt => (
						<option key={opt} value={opt}>
							{formatAxisLabel(opt)}
						</option>
					))}
				</select>
			</div>
		);
	}

	const uniqueArtists = Array.from(
		new Set(data.map(d => d.artist_name))
	).sort();

	// /* Note: Add Toggle for these - Button that opens [About] */
	return (
		<div className="page">
		<h2 className="dashboard-title">
			<b>Genre Families</b>: Genre, Popularity, and Temporal Structure in Contemporary Music
			<span className="dashboard-title-sub">
				How Genre and Artist Visibility Shape Track Popularity Over Time
			</span>
		</h2>
		<div className="dashboard-subtitle">
			<div className="figure-guide">
				<strong>Figure guide.</strong>
				<span>
					<strong>(Top)</strong> Stream graph — year-by-year genre family composition.
					<em> Area thickness</em> encodes relative genre prevalence within each year (wiggle-offset for readability).
				</span>
				
				<span>
					<br />
					<strong>(Bottom-left)</strong> Scatter + trend lines — association between{" "}
					<strong>{formatAxisLabel(xAxisField).toLowerCase()}</strong> and{" "}
					<strong>{formatAxisLabel(yAxisField).toLowerCase()}</strong>.
					<em> Point size</em> = {formatAxisLabel(sizeField).toLowerCase()};{" "}
					<em>color</em> = genre family;{" "}
					<em>lines</em> = per-genre least-squares fit.
				</span>

				<span>
					<br></br>
					<strong>(Bottom-right)</strong> Bar chart — baseline track popularity by genre family.
					<em> Bar height</em> = mean popularity; <em>error bar (variability)</em> = ±1 standard deviation.
				</span>
			</div>

			<div className="figure-goal">
				<br></br>
				<strong>Objective:</strong> Does genre context and artist popularity jointly structure track popularity,
				and whether genres differ in baseline popularity and variability.
			</div>

			<div className="genre-family-note">
				<br></br>
				<strong>Genre Families (modern → legacy):</strong> Individual Spotify subgenres are aggregated into broader genre families for clearer visualization and analysis.
				<br></br>When artists are associated with multiple genres, classification order emphasizes contemporary mainstream categories. <b>(e.g., Pop before Country / Folk)</b><br></br>
			</div>

			<div>
				<br></br>
				<strong>Families:</strong> <b>Pop</b> (e.g., K-pop, dance pop), Hip-Hop / Rap (e.g., trap),
				Rock / Alternative (e.g., indie rock, metal), Electronic / EDM (e.g., house, techno),
				R&B / Soul, Latin, Country / Folk, Jazz / Gospel, and Soundtrack.
			</div>

		</div>


			<div className="dashboard">
				<div className="top-row">
					<div className="panel">
						<h3>Stream Graph: Genre Composition Over Time</h3>
						{/* Temporal aggregate view showing relative genre prevalence over release years */}
						<StreamGraph
							data={data}
							onVisibleRangeChange={setVisibleYearRange}
						/>
					</div>
				</div>

				<div className="bottom-row">
					<div className="panel">
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between"
							}}
						>
							<h3 style={{ margin: 0 }}>
								Scatter Plot: {formatAxisLabel(yAxisField)} vs {formatAxisLabel(xAxisField)}
							</h3>

							<div style={{ position: "relative" }}>
								<button
									onClick={() => setShowSettings(s => !s)}
									style={{
										border: "none",
										background: "transparent",
										cursor: "pointer",
										fontSize: "16px",
										padding: "2px 4px"
									}}
									title="Axis Settings"
								>
									🔍
								</button>

								{showSettings && (
									<div
										style={{
											position: "absolute",
											top: "100%",
											right: 0,
											marginTop: "6px",
											background: "white",
											border: "1px solid #ccc",
											padding: "10px",
											fontSize: "11px",
											boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
											zIndex: 50
										}}
									>
										{renderDropdown("X Axis", xAxisField, setXAxisField)}
										{renderDropdown("Y Axis", yAxisField, setYAxisField)}
										{renderDropdown("Point Size", sizeField, setSizeField)}
									</div>
								)}
							</div>
						</div>


						<div
							style={{
								fontSize: "11px",
								color: "#444",
								marginBottom: "8px",
								lineHeight: "1.4",
								textAlign: "center"
							}}
						>
							<div>
								<strong>Points:</strong> Individual tracks (size scaled by artist followers).
							</div>
							<div>
								<strong>Lines:</strong> Per-genre linear least-squares fit.
							</div>
						</div>
						{/* Position encoding for quantitative comparison;
							(color used for categorical genre separation) */}
						<div style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "12px",
							marginBottom: "8px",
							flexWrap: "wrap"
						}}>
							<label style={{ fontSize: "12px" }}>
								<strong>Select Artist:</strong>
							</label>

							<select
								value={selectedArtist ?? ""}
								onChange={(e) =>
									setSelectedArtist(
										e.target.value === "" ? null : e.target.value
									)
								}
								style={{
									padding: "4px 8px",
									fontSize: "11px",
									maxWidth: "180px"
								}}
							>
								<option value="">None</option>
								{uniqueArtists.map(name => (
									<option key={name} value={name}>
										{name}
									</option>
								))}
							</select>

							<label style={{ fontSize: "11px" }}>
								<input
									type="checkbox"
									checked={showArtistPoints}
									onChange={e => setShowArtistPoints(e.target.checked)}
									style={{ marginRight: "4px" }}
								/>
								Show Artist Points
							</label>

							<label style={{ fontSize: "11px" }}>
								<input
									type="checkbox"
									checked={showArtistLines}
									onChange={e => setShowArtistLines(e.target.checked)}
									style={{ marginRight: "4px" }}
								/>
								Show Genre Lines
							</label>
						</div>
	
							{/* Position encoding for quantitative comparison;
								(color used for categorical genre separation) */}
								<ScatterTrend
									data={data}
									selectedArtist={selectedArtist}
									showArtistPoints={showArtistPoints}
									showArtistLines={showArtistLines}
									xField={xAxisField}
									yField={yAxisField}
									sizeField={sizeField}
									xLabel={formatAxisLabel(xAxisField)}
									yLabel={formatAxisLabel(yAxisField)}
								/>
						</div>

					<div className="panel" style={{ position: "relative" }}>
						<h3>
							{linkBarToStream && visibleYearRange
								? `Mean Track Popularity by Genre (${visibleYearRange[0]}–${visibleYearRange[1]})`
								: "Mean Track Popularity by Genre (All Years)"}
						</h3>

						<div style={{ textAlign: "center", fontSize: "11px", marginBottom: "4px" }}>
							<label>
								<input
									type="checkbox"
									checked={linkBarToStream}
									onChange={e => setLinkBarToStream(e.target.checked)}
									style={{ marginRight: "4px" }}
								/>
								Link to Streamgraph Zoom
							</label>
						</div>
						{/* baseline differences in track popularity across genres, providing context for the genre */}
						<BarChart
							data={data}
							visibleYearRange={visibleYearRange}
							linkEnabled={linkBarToStream}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}