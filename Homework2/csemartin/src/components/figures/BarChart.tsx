// BarChart.tsx
import { useEffect } from "react";
import * as d3 from "d3";
import { GENRES, genreColorScale } from "../../colors";
import type { Track } from "../Dashboard";

type GenreStat = {
	genre: string;
	mean: number;
	sd: number;
};

export default function BarChart({ data }: { data: Track[] }) {
	useEffect(() => { // Check if data is available
		if (!data || data.length === 0) return;

		const svg = d3.select("#bar-svg");

		const draw = () => {
			svg.selectAll("*").remove();

			// Set up margins and dimensions
			const margin = { top: 40, right: 40, bottom: 60, left: 60 };
			const svgNode = svg.node() as SVGSVGElement;

			const width = svgNode.clientWidth - margin.left - margin.right;
			const height = svgNode.clientHeight - margin.top - margin.bottom;

			if (width <= 0 || height <= 0) return;

			const g = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Aggregate mean and standard deviation per genre
			const stats: GenreStat[] = GENRES.map(genre => {
				const values = data
					.filter(d => d.genre === genre)
					.map(d => d.track_popularity)
					.filter(v => Number.isFinite(v));

				return {
					genre,
					mean: d3.mean(values)!,
					sd: d3.deviation(values) || 0
				};
			});

			// Sort by mean popularity (supports comparison narrative)
			stats.sort((a, b) => b.mean - a.mean);

			// X scale (categorical)
			const x = d3.scaleBand()
				.domain(stats.map(d => d.genre))
				.range([0, width])
				.padding(0.25);

			// Y scale (Spotify popularity score)
			const y = d3.scaleLinear()
				.domain([0, 100])
				.range([height, 0]);

			// Axes
			g.append("g")
				.attr("transform", `translate(0,${height})`)
				.call(d3.axisBottom(x));

			g.append("g")
				.call(d3.axisLeft(y));

			// Bars: mean track popularity
			g.selectAll(".bar")
				.data(stats)
				.enter()
				.append("rect")
				.attr("class", "bar")
				.attr("x", d => x(d.genre)!)
				.attr("y", d => y(d.mean))
				.attr("width", x.bandwidth())
				.attr("height", d => height - y(d.mean))
				.attr("fill", d => genreColorScale(d.genre))
				.attr("opacity", 0.85);

			// Vertical error bars: (+/-)1 standard deviation
			g.selectAll(".error-line")
				.data(stats)
				.enter()
				.append("line")
				.attr("class", "error-line")
				.attr("x1", d => x(d.genre)! + x.bandwidth() / 2)
				.attr("x2", d => x(d.genre)! + x.bandwidth() / 2)
				.attr("y1", d => y(d.mean - d.sd))
				.attr("y2", d => y(d.mean + d.sd))
				.attr("stroke", "#222")
				.attr("stroke-width", 1.5);

			// Horizontal cap at mean
			const capWidth = x.bandwidth() * 0.6;

			g.selectAll(".mean-cap")
				.data(stats)
				.enter()
				.append("line")
				.attr("class", "mean-cap")
				.attr("x1", d => x(d.genre)! + (x.bandwidth() - capWidth) / 2)
				.attr("x2", d => x(d.genre)! + (x.bandwidth() + capWidth) / 2)
				.attr("y1", d => y(d.mean))
				.attr("y2", d => y(d.mean))
				.attr("stroke", "#111")
				.attr("stroke-width", 2.5);

			// Numeric mean labels
			g.selectAll(".mean-label")
				.data(stats)
				.enter()
				.append("text")
				.attr("class", "mean-label")
				.attr("x", d => x(d.genre)! + x.bandwidth() / 2)
				.attr("y", d => y(d.mean) - 6)
				.attr("text-anchor", "middle")
				.attr("font-size", "10px")
				.attr("fill", "#111")
				.text(d => d.mean.toFixed(1));

			// Axis labels
			g.append("text")
				.attr("x", width / 2)
				.attr("y", height + 45)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Genre");

			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -height / 2)
				.attr("y", -45)
				.attr("text-anchor", "middle")
				.attr("font-size", "12px")
				.text("Mean Track Popularity (Spotify Score)");

			// Explanatory annotation
			const note = g.append("g")
				.attr("transform", "translate(20, 10)");

			note.append("rect")
				.attr("width", 300)
				.attr("height", 48)
				.attr("fill", "#f8f8f8")
				.attr("stroke", "#ccc")
				.attr("rx", 4)
				.attr("opacity", 0.9);

			note.append("text")
				.attr("x", 10)
				.attr("y", 20)
				.attr("font-size", "10px")
				.text("Bar height: mean track popularity by genre");

			note.append("text")
				.attr("x", 10)
				.attr("y", 34)
				.attr("font-size", "10px")
				.text("Vertical line: ±1 standard deviation");
		};

		draw();

		const onResize = () => draw();
		window.addEventListener("resize", onResize);

		return () => {
			window.removeEventListener("resize", onResize);
		};

	}, [data]);

	return <svg id="bar-svg" />;
}