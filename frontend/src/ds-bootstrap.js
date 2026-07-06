// 디자인 시스템 wiring 부트스트랩.
//
// design-system/_ds_bundle.js 는 사전 트랜스파일된 IIFE로, 전역 `React`(React.createElement 등)를
// 참조하며 컴포넌트를 window.Ds_a0b250 에 붙인다. 따라서 번들 실행 "전에" window.React 를
// 주입해야 한다. 이 모듈을 번들보다 먼저 import 하면 순서가 보장된다(ESM 정적 import 순서).
import React from "react";
import * as ReactDOMClient from "react-dom/client";

window.React = React;
// 번들 내 데모(app-shell)가 window.ReactDOM.createRoot 를 참조. react-dom/client 로 제공해
// deprecation 경고를 피한다. 데모 마운트 자체는 index.html 에 #root 가 없어 무력화된다
// (createRoot(null) → 번들 자체 try/catch 에 삼켜짐).
window.ReactDOM = ReactDOMClient;
