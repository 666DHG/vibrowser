import { useId } from "react";

export function HomePlanet() {
  const id = useId();
  const sphere = `${id}-sphere`;
  const glow = `${id}-glow`;
  const clip = `${id}-clip`;
  return (
    <svg
      viewBox="0 0 480 340"
      role="img"
      aria-label="环绕星轨的绿色小星球"
      className="mx-auto w-full max-w-[460px] select-none max-lg:max-w-[340px]"
      fill="none"
    >
      <defs>
        <radialGradient id={glow}>
          <stop stopColor="#9ebd7d" stopOpacity=".14" />
          <stop offset="1" stopColor="#9ebd7d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={sphere} cx=".3" cy=".22" r=".85">
          <stop stopColor="#d9e7b6" />
          <stop offset=".4" stopColor="#9fb97d" />
          <stop offset=".75" stopColor="#526d46" />
          <stop offset="1" stopColor="#293e2d" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="240" cy="170" r="89" />
        </clipPath>
      </defs>
      <ellipse cx="240" cy="176" rx="222" ry="160" fill={`url(#${glow})`} />
      <ellipse
        cx="240"
        cy="170"
        rx="203"
        ry="111"
        transform="rotate(-24 240 170)"
        stroke="#a8c18a"
        strokeOpacity=".12"
        strokeDasharray="2 10"
      />
      <ellipse
        cx="240"
        cy="170"
        rx="186"
        ry="59"
        transform="rotate(-24 240 170)"
        stroke="#b7ce9c"
        strokeOpacity=".32"
        strokeWidth="2"
      />
      <circle cx="240" cy="170" r="89" fill={`url(#${sphere})`} />
      <g
        clipPath={`url(#${clip})`}
        stroke="#e4edc6"
        strokeOpacity=".17"
        strokeWidth="1.2"
      >
        <path d="M149 139C198 167 266 138 303 108M151 161C208 196 280 160 324 130M155 186C221 223 292 182 332 157M169 212C230 247 296 213 329 192" />
        <ellipse
          cx="240"
          cy="170"
          rx="36"
          ry="90"
          transform="rotate(-24 240 170)"
        />
        <ellipse
          cx="240"
          cy="170"
          rx="68"
          ry="90"
          transform="rotate(-24 240 170)"
        />
      </g>
      <circle cx="240" cy="170" r="89" stroke="#e1ecc5" strokeOpacity=".2" />
      <path
        d="M80 242C101 265 188 255 264 221S411 137 410 113"
        stroke="#172019"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M80 239C105 260 185 249 263 216S407 136 410 113"
        stroke="#c3d5a6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M84 245C115 267 205 246 272 216"
        stroke="#b4ca96"
        strokeOpacity=".35"
        strokeLinecap="round"
      />
      <circle cx="388" cy="86" r="9" fill="#bacc9f" />
      <circle cx="386" cy="83" r="2" fill="#e5edce" />
      <circle cx="102" cy="266" r="3" fill="#b8cf98" />
      <g stroke="#c8d8ae" strokeLinecap="round">
        <path d="M106 82v12m-6-6h12" />
        <path d="M355 260v8m-4-4h8" strokeOpacity=".7" />
        <path d="M302 52v6m-3-3h6" strokeOpacity=".5" />
      </g>
      <g fill="#a9bd91">
        <circle cx="68" cy="175" r="1.5" />
        <circle cx="163" cy="51" r="1.5" />
        <circle cx="423" cy="221" r="1.5" />
        <circle cx="203" cy="292" r="2" />
      </g>
    </svg>
  );
}
