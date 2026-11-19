import { describe, expect, it } from "vitest";
import { formatLufs, hasSound, loudnormApplyFilter, parseLoudnorm } from "./loudness";

const STDERR = `[Parsed_loudnorm_0 @ 0x1]
{
	"input_i" : "-23.41",
	"input_tp" : "-6.02",
	"input_lra" : "4.30",
	"input_thresh" : "-33.80",
	"output_i" : "-14.02",
	"output_tp" : "-1.60",
	"output_lra" : "4.10",
	"output_thresh" : "-24.40",
	"normalization_type" : "linear",
	"target_offset" : "0.02"
}`;

describe("masterizado", () => {
	it("lee la medición de loudnorm (entrada y salida)", () => {
		expect(parseLoudnorm(`ruido previo\n${STDERR}`)).toEqual({
			integrated: -23.41,
			truePeak: -6.02,
			range: 4.3,
			threshold: -33.8,
			offset: 0.02,
		});
		expect(parseLoudnorm(STDERR, "output").integrated).toBe(-14.02);
	});

	it("un video mudo no se masteriza", () => {
		const silent = parseLoudnorm(STDERR.replace('"-23.41"', '"-inf"'));
		expect(silent.integrated).toBe(-Infinity);
		expect(hasSound(silent)).toBe(false);
	});

	it("la segunda pasada usa lo medido y ganancia lineal", () => {
		const filter = loudnormApplyFilter(parseLoudnorm(STDERR));
		expect(filter).toContain("I=-14:TP=-1.5");
		expect(filter).toContain("measured_I=-23.41");
		expect(filter).toContain("linear=true");
		expect(() => parseLoudnorm("sin informe")).toThrow();
	});

	it("muestra la sonoridad", () => {
		expect(formatLufs(-14.02)).toBe("−14,0 LUFS");
	});
});
