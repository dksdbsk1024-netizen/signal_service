// import 순서 중요:
// 1) ds-bootstrap — window.React 주입
// 2) _ds_bundle.js — 전역 React 참조하며 window.Ds_a0b250 구성 (IIFE, side-effect)
// 3) styles.css — 디자인 토큰 + 폰트
import "./ds-bootstrap.js";
import "./design-system/_ds_bundle.js";
// 번들의 SettingsPanel 은 모듈 평가 시점(네임스페이스 미완성)에 DirectionGauge/ContributionBar 를
// 구조분해해 undefined 로 고정되는 로드-순서 버그가 있다. 번들이 window.Ds_a0b250 를 모두 채운 "뒤"에
// 소스를 다시 import 하면 올바른 바인딩으로 window.SettingsPanel/SettingsGearButton 을 재정의한다.
import "./design-system/ui_kits/_shared/SettingsPanel.jsx";
import "./design-system/styles.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
