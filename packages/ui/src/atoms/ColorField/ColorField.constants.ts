export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** El selector nativo solo acepta #rrggbb: mientras el texto es inválido muestra gris. */
export const pickerValue = (value: string): string =>
	HEX_COLOR.test(value) ? value.toLowerCase() : "#808080";
