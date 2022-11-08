import React from "react";

const checkCircle = "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
const dotsCircle = "M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
export function StatusIcon({ success = false }) {
  const colorClass = success ? "text-green-600" : "text-blue-600";
  return (
    <div className="inline-block align-middle">
      <svg
        className={`w-5 h-5 ${colorClass}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d={success ? checkCircle : dotsCircle}
        ></path>
      </svg>
    </div>
  );
}
export function FuncIcon() {
  return (
    <svg
      className="w-5 h-5 inline-block align-bottom"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4.871 4A17.926 17.926 0 003 12c0 2.874.673 5.59 1.871 8m14.13 0a17.926 17.926 0 001.87-8c0-2.874-.673-5.59-1.87-8M9 9h1.246a1 1 0 01.961.725l1.586 5.55a1 1 0 00.961.725H15m1-7h-.08a2 2 0 00-1.519.698L9.6 15.302A2 2 0 018.08 16H8"
      ></path>
    </svg>
  );
}
