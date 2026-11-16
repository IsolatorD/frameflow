import type { FrameflowApi } from "../shared/api";

declare global {
	interface Window {
		frameflow: FrameflowApi;
	}
}
