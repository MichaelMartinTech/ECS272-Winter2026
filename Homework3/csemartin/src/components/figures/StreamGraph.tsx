import { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import { GENRES, genreColorScale } from "../../colors";
import type { Track } from "../Dashboard";

type YearGenreRow = {
	year: number;
	[key: string]: number;
};

export default function StreamGraph({
	data,
	onVisibleRangeChange
}: {
	data: Track[];
	onVisibleRangeChange?: (range: [number, number]) => void;
}) {
	const [magnitudeScalingEnabled, setMagnitudeScalingEnabled] = useState(true);
	const zoomTransformRef = useRef(d3.zoomIdentity);

	const genreVisibilityRef = useRef<Map<string, boolean>>(
		new Map(GENRES.map(g => [g, true]))
	);

	useEffect(() => { // Check if data is available
		if (!data) return;

		const svg = d3.select<SVGSVGElement, unknown>("#streamgraph-svg");

		const draw = () => {
			svg.selectAll("*").remove();

			// Set up margins and dimensions
			const margin = { top: 30, right: 140, bottom: 40, left: 60 };
			const svgNode = svg.node() as SVGSVGElement;

			const width = svgNode.clientWidth - margin.left - margin.right;
			const height = svgNode.clientHeight - margin.top - margin.bottom;

			if (width <= 0 || height <= 0) return;

			const g = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Clip path to prevent layers from drawing outside plot bounds
			const defs = svg.append("defs");

			defs.append("clipPath")
			.attr("id", "stream-clip")
			.append("rect")
			.attr("width", width)
			.attr("height", height);

			// Filter data to valid years observed in dataset
			const filtered = data.filter(d =>
				d.release_year >= 1950 && d.release_year <= 2025
			);

			// Aggregate by year and genre
			const years = Array.from(
				new Set(filtered.map(d => d.release_year))
			).sort((a, b) => a - b);

			const aggregated: YearGenreRow[] = years.map(year => {
				const row: YearGenreRow = { year };

				GENRES.forEach(genre => {
					row[genre] = filtered.filter(
						d => d.release_year === year && d.genre === genre
					).length;
				});

				return row;
			});

			// Track genre visibility (true = emphasized)
			//const genreVisibility = new Map<string, boolean>();
			//GENRES.forEach(g => genreVisibility.set(g, true));

			// X scale (temporal)
			const x = d3.scaleLinear()
				.domain(d3.extent(years) as [number, number])
				.range([0, width]);

			const stack = d3.stack<YearGenreRow>()
				.keys(GENRES)
				.offset(d3.stackOffsetNone);

			// Initial stack
			let layers = stack(aggregated);

			const rawYMin = d3.min(layers, layer => d3.min(layer, d => d[0]))!;
			const rawYMax = d3.max(layers, layer => d3.max(layer, d => d[1]))!;

			const yMin = Math.floor(rawYMin);
			const yMax = Math.ceil(rawYMax);

			const y = d3.scaleLinear()
				.domain([yMin, yMax])
				.range([height, 0])
				.nice();

			const xAxis = g.append("g")
				.attr("class", "x-axis")
				.attr("transform", `translate(0,${height})`)
				.call(
					d3.axisBottom(x)
						.ticks(10)
						.tickFormat(d3.format("d"))
				);

			const yAxis = g.append("g")
				.attr("class", "y-axis")
				.call(
					d3.axisLeft(y)
						.ticks(8)
						.tickFormat(d3.format("d"))
				);

			const layerGroup = g.append("g")
				.attr("clip-path", "url(#stream-clip)");

			const area = d3.area<any>()
				.x(d => x(d.data.year))
				.y0(d => y(d[0]))
				.y1(d => y(d[1]))
				.curve(d3.curveCatmullRom);

			const paths = layerGroup.selectAll(".layer")
				.data(layers)
				.enter()
				.append("path")
				.attr("class", "layer")
				.attr("d", area)
				.attr("fill", d => genreColorScale(d.key))
				.attr("opacity", 0.9);

			//let magnitudeScalingEnabled = true;
			let rafId = 0;
			let currentTransform = zoomTransformRef.current;

			// Recompute stack but keep structure stable
			const updateYScaleAndRedraw = (
				zx: d3.ScaleLinear<number, number>,
				x0: number,
				x1: number
			) => {

				// Reset layers to original stack
				layers = stack(aggregated);

				// Collapse hidden genres in-place (fast)
				GENRES.forEach((genre, genreIndex) => {
					if (!genreVisibilityRef.current.get(genre)) {

						const layer = layers[genreIndex];

						layer.forEach((point, i) => {
							const delta = point[1] - point[0];

							// Zero this layer
							point[1] = point[0];

							// Shift all layers above downward
							for (let j = genreIndex + 1; j < layers.length; j++) {
								layers[j][i][0] -= delta;
								layers[j][i][1] -= delta;
							}
						});
					}
				});

				const visiblePoints = layers.flatMap(layer =>
					layer.filter(d =>
						d.data.year >= x0 && d.data.year <= x1
					)
				);

				if (visiblePoints.length === 0) return;

				const vMin = d3.min(visiblePoints, d => d[0])!;
				const vMax = d3.max(visiblePoints, d => d[1])!;

				if (magnitudeScalingEnabled) {
					y.domain([Math.floor(vMin), Math.ceil(vMax)]).nice();
				} else {
					y.domain([yMin, yMax]).nice();
				}

				yAxis.transition()
					.duration(150)
					.call(
						d3.axisLeft(y)
							.ticks(8)
							.tickFormat(d3.format("d"))
					);

				paths
					.data(layers)
					.transition()
					.duration(60)
					.attr("d", d3.area<any>()
						.x(d => zx(d.data.year))
						.y0(d => y(d[0]))
						.y1(d => y(d[1]))
						.curve(d3.curveCatmullRom)
					);
			};


			const zoom = d3.zoom<SVGSVGElement, unknown>()
				.scaleExtent([1, 8])
				.translateExtent([[0, 0], [width, height]])
				.extent([[0, 0], [width, height]])
				.on("zoom", (event) => {
					currentTransform = event.transform;
					zoomTransformRef.current = event.transform;
					if (rafId) cancelAnimationFrame(rafId);

					rafId = requestAnimationFrame(() => {
						rafId = 0;

						const zx = event.transform.rescaleX(x);
						xAxis.call(
							d3.axisBottom(zx)
								.ticks(10)
								.tickFormat(d3.format("d"))
						);

						const [x0, x1] = zx.domain();
						onVisibleRangeChange?.([
							Math.round(x0),
							Math.round(x1)
						]);

						updateYScaleAndRedraw(zx, x0, x1);
					});
				});

			// Legend
			const legend = g.append("g")
				.attr("transform", `translate(${width + 10}, -10)`);

			GENRES.forEach((genre, i) => {
				const row = legend.append("g")
					.attr("transform", `translate(0, ${i * 16})`)
					.style("cursor", "pointer");

				// --- store references ---
				const rect = row.append("rect")
					.attr("width", 10)
					.attr("height", 10)
					.attr("fill", genreColorScale(genre));

				const text = row.append("text")
					.attr("x", 14)
					.attr("y", 9)
					.attr("font-size", "10px")
					.text(genre);

				// --- hover behavior ---
				row.on("mouseenter", function () {
					text.attr("font-weight", "bold");

					paths.transition()
						.duration(120)
						.attr("opacity", d =>
							d.key === genre ? 1 :
							genreVisibilityRef.current.get(d.key) ? 0.4 : 0
						);
				});

				row.on("mouseleave", function () {
					text.attr("font-weight", "normal");

					paths.transition()
						.duration(120)
						.attr("opacity", d =>
							genreVisibilityRef.current.get(d.key) ? 0.9 : 0
						);
				});

				// --- click behavior ---
				row.on("click", () => {
					const current = genreVisibilityRef.current.get(genre)!;
					const newState = !current;

					genreVisibilityRef.current.set(genre, newState);

					// legend visual update
					row.transition()
						.duration(150)
						.style("opacity", newState ? 1 : 0.35);

					text.style("text-decoration",
						newState ? "none" : "line-through"
					);

					const zx = currentTransform.rescaleX(x);
					const [x0, x1] = zx.domain();
					updateYScaleAndRedraw(zx, x0, x1);
				});

			});

			svg.call(zoom as any);

			// restore previous zoom state FIRST
			svg.call(zoom.transform, zoomTransformRef.current);

			// now compute using current transform
			const zx = zoomTransformRef.current.rescaleX(x);
			const [x0, x1] = zx.domain();
			updateYScaleAndRedraw(zx, x0, x1);
		};

		draw();

		const onResize = () => draw();
		window.addEventListener("resize", onResize);

		return () => {
			window.removeEventListener("resize", onResize);
		};

	}, [data, magnitudeScalingEnabled]);

	return (
		<div>
			<div style={{
				textAlign: "center",
				fontSize: "13px",
				marginBottom: "6px"
			}}>
				<label>
					<input
						type="checkbox"
						checked={magnitudeScalingEnabled}
						onChange={e => setMagnitudeScalingEnabled(e.target.checked)}
						style={{ marginRight: "6px" }}
					/>
					Auto-scale Y (Dynamic Magnitude)
				</label>
			</div>

			<svg id="streamgraph-svg"></svg>
		</div>
	);
}