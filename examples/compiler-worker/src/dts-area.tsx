import React from "react";

export function DTSArea({ onChange, defaultValue }) {
  function handleChange(e) {
    onChange(e.target.value)
  }

  return (
    <textarea
      name="dts"
      id="dtsTextArea"
      className="rounded-lg bg-slate-800 shadow-lg text-slate-200 font-mono"
      cols="80"
      rows="18"
      onChange={handleChange}
      defaultValue={defaultValue}
    ></textarea>
  );
}
