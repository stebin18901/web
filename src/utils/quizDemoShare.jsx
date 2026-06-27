import React from "react";
import { BlockMath, InlineMath } from "react-katex";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const normalizePreviewText = (value) =>
  String(value ?? "")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™]/g, "'")
    .replace(/[â€¢â—]/g, "-")
    .replace(/[â‚¹]/g, "Rs ")
    .replace(/\s+/g, " ")
    .trim();

export const getQuizClass = (quiz) =>
  normalizePreviewText(
    quiz?.metadata?.class ??
      quiz?.class ??
      quiz?.className ??
      quiz?.grade ??
      ""
  );

export const getQuizSubject = (quiz) =>
  normalizePreviewText(quiz?.metadata?.subject ?? quiz?.subject ?? "");

export const getQuizChapter = (quiz) =>
  normalizePreviewText(quiz?.metadata?.chapter ?? quiz?.chapter ?? "");

export const getQuizConcept = (quiz) =>
  normalizePreviewText(quiz?.metadata?.concept ?? quiz?.concept ?? "");

export const getQuestionOptions = (question) => {
  const options = question?.options;
  if (!options) return [];

  if (Array.isArray(options)) {
    return options.map((value, index) => ({
      key: LETTERS[index] || String(index + 1),
      value: String(value ?? "").trim(),
    }));
  }

  return Object.entries(options)
    .map(([key, value]) => ({
      key: String(key ?? "").trim(),
      value: String(value ?? "").trim(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

export const parseExampleSteps = (exampleText) =>
  String(exampleText ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(Step\s*\d+|Result|Problem)\s*:\s*(.*)$/i);
      if (match) {
        return {
          label: match[1],
          content: match[2] || "-",
        };
      }

      return {
        label: "Note",
        content: line,
      };
    });

export const buildQuizDemoSearch = ({ selectedClass, selectedSubject, selectedChapter }) => {
  const params = new URLSearchParams();
  params.set("class", selectedClass || "");
  params.set("subject", selectedSubject || "");
  params.set("chapter", selectedChapter || "");
  return params.toString();
};

const decodeMathText = (value) =>
  String(value || "")
    .replace(/&middot;|&#183;|&#xB7;/g, "·")
    .replace(/&times;/g, "×")
    .replace(/&divide;/g, "÷")
    .replace(/&nbsp;/g, " ")
    .replace(/[â€¢â—]/g, "·")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™]/g, "'")
    .replace(/Ã—/g, "×")
    .replace(/Ã·/g, "÷")
    .replace(/Â·/g, "·");

const normalizeLatex = (value) =>
  String(value || "")
    .replace(/·/g, " \\cdot ")
    .replace(/×/g, " \\times ")
    .replace(/÷/g, " \\div ");

const renderPlainWithBreaks = (value, keyPrefix) =>
  String(value || "")
    .split("\n")
    .map((line, index, arr) => (
      <React.Fragment key={`${keyPrefix}-plain-${index}`}>
        {line}
        {index < arr.length - 1 ? <br /> : null}
      </React.Fragment>
    ));

export const renderMathText = (value, className = "", keyPrefix = "math") => {
  const text = decodeMathText(value);
  if (!text.trim()) return null;

  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith("$$") && part.endsWith("$$")) {
          const math = normalizeLatex(part.slice(2, -2)).trim();
          return (
            <BlockMath
              key={`${keyPrefix}-block-${index}`}
              math={math}
              renderError={() => <span>{part}</span>}
            />
          );
        }

        if (part.startsWith("\\[") && part.endsWith("\\]")) {
          const math = normalizeLatex(part.slice(2, -2)).trim();
          return (
            <BlockMath
              key={`${keyPrefix}-display-${index}`}
              math={math}
              renderError={() => <span>{part}</span>}
            />
          );
        }

        if (part.startsWith("$") && part.endsWith("$")) {
          const math = normalizeLatex(part.slice(1, -1)).trim();
          return (
            <InlineMath
              key={`${keyPrefix}-inline-${index}`}
              math={math}
              renderError={() => <span>{part}</span>}
            />
          );
        }

        if (part.startsWith("\\(") && part.endsWith("\\)")) {
          const math = normalizeLatex(part.slice(2, -2)).trim();
          return (
            <InlineMath
              key={`${keyPrefix}-paren-${index}`}
              math={math}
              renderError={() => <span>{part}</span>}
            />
          );
        }

        return (
          <React.Fragment key={`${keyPrefix}-text-${index}`}>
            {renderPlainWithBreaks(part, `${keyPrefix}-${index}`)}
          </React.Fragment>
        );
      })}
    </span>
  );
};
