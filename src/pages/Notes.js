import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import "./Notes.css";

const Notes = ({ chapterId }) => {
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChapter = async () => {
      if (!chapterId) return;

      try {
        setLoading(true);
        setError(null);

        const chapterDoc = await getDoc(doc(db, "chapters", chapterId));

        if (!chapterDoc.exists()) {
          throw new Error("Chapter not found");
        }

        const data = chapterDoc.data();

        if (!data.chapter || !data.chapter.sections) {
          throw new Error("No content available for the chapter");
        }

        setChapter(data.chapter);
      } catch (err) {
        console.error("Error fetching chapter:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChapter();
  }, [chapterId]);

  if (loading) {
    return (
      <div className="notes-loading">
        <div className="spinner"></div>
        <p>Loading chapter content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notes-error">
        <p>⚠️ {error}</p>
      </div>
    );
  }

  if (!chapter) return null;

  return (
    <div className="notes-container">
      <div className="notes-header">
        <h2 className="notes-title">{chapter.title}</h2>
      </div>

      <div className="notes-content">
        {chapter.sections.map((section, index) => (
          <div key={index} className="notes-section">
            {section.title && <h3 className="section-title">{section.title}</h3>}

            {section.content?.text && (
              <div className="text-content">
                {section.content.text.split("\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}

            {section.content?.interactive?.type === "mcq" && (
              <div className="interactive-mcq">
                <p><strong>{section.content.interactive.question}</strong></p>
                <ul>
                  {section.content.interactive.options.map((opt, i) => (
                    <li key={i}>{opt.text}</li>
                  ))}
                </ul>
                {section.content.interactive.hint && (
                  <p className="hint">Hint: {section.content.interactive.hint}</p>
                )}
              </div>
            )}

            {section.content?.interactive?.type === "classification" && (
              <div className="interactive-classification">
                <p><strong>{section.content.interactive.question}</strong></p>
                {section.content.interactive.items.map((item, i) => (
                  <div key={i}>
                    <p>{item.value}</p>
                    <ul>
                      {item.options.map((opt, j) => (
                        <li key={j}>{opt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {section.content?.interactive?.type === "plot" && (
              <div className="interactive-plot">
                <p><strong>{section.content.interactive.question}</strong></p>
                <ol>
                  {section.content.interactive.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {section.content?.interactive?.type === "step_solver" && (
              <div className="interactive-step-solver">
                <p><strong>Problem:</strong> {section.content.interactive.problem}</p>
                <ol>
                  {section.content.interactive.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}

        {chapter.assessment && (
          <div className="chapter-assessment">
            <h3>Assessment</h3>
            {chapter.assessment.map((q, i) => (
              <div key={i} className="assessment-question">
                <p><strong>{q.question}</strong></p>
                {q.type === "true_false" && (
                  <p>Answer: {q.correct ? "True" : "False"}</p>
                )}
                {q.explanation && <p>Explanation: {q.explanation}</p>}
                {q.type === "calculation" && (
                  <>
                    <p>Method: {q.solution.method}</p>
                    <p>Answer: {q.solution.answer}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export { Notes };