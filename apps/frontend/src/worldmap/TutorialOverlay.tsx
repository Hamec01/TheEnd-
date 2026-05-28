import { useEffect, useMemo, useState } from "react";
import type { TutorialDefinition } from "../services/tutorialDefinitions";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  tutorial: TutorialDefinition;
  currentStepIndex: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

function resolveHighlightRect(selector: string | undefined): HighlightRect | null {
  if (!selector || typeof document === "undefined") {
    return null;
  }

  const target = document.querySelector(selector);
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function TutorialOverlay(props: TutorialOverlayProps) {
  const { tutorial, currentStepIndex, onNext, onSkip, onComplete } = props;
  const step = tutorial.steps[currentStepIndex] ?? null;
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const isLastStep = currentStepIndex >= tutorial.steps.length - 1;

  const progressLabel = useMemo(
    () => `${Math.min(tutorial.steps.length, currentStepIndex + 1)} / ${tutorial.steps.length}`,
    [currentStepIndex, tutorial.steps.length],
  );

  useEffect(() => {
    if (!step?.targetSelector) {
      setHighlightRect(null);
      return;
    }

    const update = () => {
      setHighlightRect(resolveHighlightRect(step.targetSelector));
    };

    update();
    const timeout = window.setTimeout(update, 100);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step?.targetSelector]);

  if (!step) {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10040,
          background: "rgba(6, 4, 2, 0.58)",
          pointerEvents: "none",
        }}
      />
      {highlightRect ? (
        <div
          style={{
            position: "fixed",
            top: Math.max(0, highlightRect.top - 6),
            left: Math.max(0, highlightRect.left - 6),
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
            zIndex: 10041,
            borderRadius: 12,
            border: "2px solid #f2cf83",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.12), 0 0 24px rgba(242, 207, 131, 0.42)",
            pointerEvents: "none",
          }}
        />
      ) : null}
      <section
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          width: "min(390px, calc(100vw - 24px))",
          zIndex: 10042,
          background: "linear-gradient(180deg, rgba(39, 28, 18, 0.98), rgba(17, 12, 8, 0.98))",
          color: "#f3e5cf",
          border: "1px solid rgba(214, 176, 102, 0.58)",
          borderRadius: 16,
          boxShadow: "0 18px 44px rgba(0, 0, 0, 0.45)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <strong style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#d6b066" }}>
            {tutorial.title}
          </strong>
          <span style={{ fontSize: 12, color: "rgba(243, 229, 207, 0.72)" }}>{progressLabel}</span>
        </div>

        <h3 style={{ margin: "10px 0 8px", fontSize: 22 }}>{step.title}</h3>
        <p style={{ margin: 0, lineHeight: 1.5, color: "rgba(243, 229, 207, 0.9)" }}>{step.text}</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            onClick={isLastStep ? onComplete : onNext}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(214, 176, 102, 0.8)",
              background: "#c89a42",
              color: "#21150b",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isLastStep ? "Завершить" : "Далее"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(214, 176, 102, 0.35)",
              background: "transparent",
              color: "#f3e5cf",
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Пропустить обучение
          </button>
        </div>
      </section>
    </>
  );
}
