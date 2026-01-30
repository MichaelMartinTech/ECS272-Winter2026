import { useEffect } from "react";
import * as d3 from "d3";
import { GENRES, genreColorScale } from "../../colors";
import type { Track } from "../Dashboard";

type YearGenreRow = {
	year: number;
	[key: string]: number;
};

export default function StreamGraph({ data }: { data: Track[] }) {
	useEffect(() => { // Check if data is available
		if (!data) return;

		const svg = d3.select("#streamgraph-svg");

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

			// X scale (temporal)
			const x = d3.scaleLinear()
				.domain(d3.extent(years) as [number, number])
				.range([0, width]);

			// Stream stack configuration
			const stack = d3.stack<YearGenreRow>()
				.keys(GENRES)
				.offset(d3.stackOffsetWiggle);

			const layers = stack(aggregated);

			// Compute raw vertical extent produced by stream stacking
			const rawYMin = d3.min(layers, layer => d3.min(layer, d => d[0]))!;
			const rawYMax = d3.max(layers, layer => d3.max(layer, d => d[1]))!;

			// Round outward to preserve extrema
			const yMin = Math.floor(rawYMin);
			const yMax = Math.ceil(rawYMax);
			
			// Y scale (relative genre prevalence)
			const y = d3.scaleLinear()
				.domain([yMin, yMax])
				.range([height, 0])
				.nice(); // produce clean integer tick steps

			// Axes
			g.append("g")
				.attr("transform", `translate(0,${height})`)
				.call(
					d3.axisBottom(x)
						.ticks(10)
						.tickFormat(d3.format("d"))
				);

			g.append("g")
				.call(
					d3.axisLeft(y)
						.ticks(8)
						.tickFormat(d3.format("d"))
				);

			// HW3 idea extension:
			// Add zoom + pan interaction along x-axis
			// to support temporal traversal and localized genre inspection

			// Area generator
			const area = d3.area<any>()
				.x((_, i) => x(aggregated[i].year))
				.y0((d: any) => y(d[0]))
				.y1((d: any) => y(d[1]))
				.curve(d3.curveCatmullRom);

			// Draw stream layers
			g.selectAll(".layer")
				.data(layers)
				.enter()
				.append("path")
				.attr("class", "layer")
				.attr("d", area)
				.attr("fill", d => genreColorScale(d.key))
				.attr("opacity", 0.9);

			// Explicit start / end year labels anchored inside plot bounds
			const startYear = years[0];
			const endYear = years[years.length - 1];

			g.append("text")
				.attr("x", x(startYear) + 6)
				.attr("y", height + 28)
				.attr("text-anchor", "start")
				.attr("font-size", "10px")
				.text(startYear);

			g.append("text")
				.attr("x", x(endYear) - 6)
				.attr("y", height + 28)
				.attr("text-anchor", "end")
				.attr("font-size", "10px")
				.text(endYear);

			// Legend
			const legend = g.append("g")
				.attr("transform", `translate(${width + 10}, 0)`);

			GENRES.forEach((genre, i) => {
				const row = legend.append("g")
					.attr("transform", `translate(0, ${i * 16})`);

				row.append("rect")
					.attr("width", 10)
					.attr("height", 10)
					.attr("fill", genreColorScale(genre));

				row.append("text")
					.attr("x", 14)
					.attr("y", 9)
					.attr("font-size", "10px")
					.text(genre);
			});

			// Explanatory annotation
			const note = g.append("g")
				.attr("transform", "translate(20, 10)");

			note.append("rect")
				.attr("width", 330)
				.attr("height", 34)
				.attr("fill", "#f8f8f8")
				.attr("stroke", "#ccc")
				.attr("rx", 4)
				.attr("opacity", 0.9);

			note.append("text")
				.attr("x", 8)
				.attr("y", 22)
				.attr("font-size", "11px")
				.text("Area height: relative genre prevalence per year (wiggle-offset)");

			// X-axis label
			g.append("text")
				.attr("x", width / 2)
				.attr("y", height + 38)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Release Year");
			// Y-axis label
			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -height / 2)
				.attr("y", -45)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Relative Genre Prevalence (Wiggle-Offset)");
		};

		draw();

		const onResize = () => draw();
		window.addEventListener("resize", onResize);

		return () => {
			window.removeEventListener("resize", onResize);
		};

	}, [data]);

	return <svg id="streamgraph-svg"></svg>;
}