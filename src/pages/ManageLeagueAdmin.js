import React, { useMemo, useState } from "react";
import "./ManageLeagueAdmin.css";

const createOption = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  text: "",
  image: null,
  isCorrect: false,
});

const createQuestion = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  text: "",
  type: "MCQ",
  image: null,
  options: [createOption(), createOption(), createOption(), createOption()],
  integerAnswer: "",
});

const ManageLeagueAdmin = () => {
  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    durationMinutes: "",
    questions: [createQuestion()],
  });

  const [quizzes, setQuizzes] = useState([]);

  const [leagueForm, setLeagueForm] = useState({
    name: "",
    feeType: "monthly",
    feeAmount: "",
    slotDateTime: "",
    assignedQuizId: "",
  });

  const [leagues, setLeagues] = useState([]);

  const quizOptions = useMemo(
    () => quizzes.map((quiz) => ({ value: quiz.id, label: quiz.title })),
    [quizzes]
  );

  const updateQuizField = (field, value) => {
    setQuizForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateQuestion = (questionId, updater) => {
    setQuizForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? updater(question) : question
      ),
    }));
  };

  const updateOption = (questionId, optionId, updater) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.map((option) =>
        option.id === optionId ? updater(option) : option
      ),
    }));
  };

  const addQuestion = () => {
    setQuizForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createQuestion()],
    }));
  };

  const removeQuestion = (questionId) => {
    setQuizForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((question) => question.id !== questionId),
    }));
  };

  const addOption = (questionId) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: [...question.options, createOption()],
    }));
  };

  const removeOption = (questionId, optionId) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.filter((option) => option.id !== optionId),
    }));
  };

  const toggleCorrectOption = (questionId, optionId) => {
    updateQuestion(questionId, (question) => {
      const isSingleChoice = question.type === "MCQ";
      return {
        ...question,
        options: question.options.map((option) => {
          if (option.id !== optionId) {
            return isSingleChoice ? { ...option, isCorrect: false } : option;
          }
          return { ...option, isCorrect: !option.isCorrect };
        }),
      };
    });
  };

  const updateLeagueField = (field, value) => {
    setLeagueForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateQuiz = (event) => {
    event.preventDefault();

    if (!quizForm.title.trim()) {
      return;
    }

    const quizPayload = {
      ...quizForm,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    setQuizzes((prev) => [quizPayload, ...prev]);
    setQuizForm({
      title: "",
      description: "",
      durationMinutes: "",
      questions: [createQuestion()],
    });
  };

  const handleCreateLeague = (event) => {
    event.preventDefault();

    if (!leagueForm.name.trim()) {
      return;
    }

    const leaguePayload = {
      ...leagueForm,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    setLeagues((prev) => [leaguePayload, ...prev]);
    setLeagueForm({
      name: "",
      feeType: "monthly",
      feeAmount: "",
      slotDateTime: "",
      assignedQuizId: "",
    });
  };

  return (
    <div className="manage-league-admin">
      <header className="manage-league-admin__header">
        <div>
          <p className="manage-league-admin__eyebrow">Admin workspace</p>
          <h1 className="manage-league-admin__title">Manage League Admin</h1>
          <p className="manage-league-admin__subtitle">
            Create quizzes, attach them to a league, and align each quiz to a slot.
          </p>
        </div>
      </header>

      <section className="manage-league-admin__section">
        <h2>Create Quiz</h2>
        <form className="manage-league-admin__form" onSubmit={handleCreateQuiz}>
          <div className="form-grid">
            <label>
              Quiz title
              <input
                type="text"
                value={quizForm.title}
                onChange={(event) => updateQuizField("title", event.target.value)}
                placeholder="e.g. Weekly aptitude"
                required
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                value={quizForm.durationMinutes}
                onChange={(event) =>
                  updateQuizField("durationMinutes", event.target.value)
                }
                placeholder="45"
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              rows="3"
              value={quizForm.description}
              onChange={(event) => updateQuizField("description", event.target.value)}
              placeholder="Quick summary for admins"
            />
          </label>

          <div className="questions">
            {quizForm.questions.map((question, index) => (
              <div key={question.id} className="question-card">
                <div className="question-card__header">
                  <h3>Question {index + 1}</h3>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeQuestion(question.id)}
                    disabled={quizForm.questions.length === 1}
                  >
                    Remove
                  </button>
                </div>
                <label>
                  Question text
                  <textarea
                    rows="2"
                    value={question.text}
                    onChange={(event) =>
                      updateQuestion(question.id, (current) => ({
                        ...current,
                        text: event.target.value,
                      }))
                    }
                    placeholder="Type the question here"
                    required
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Question type
                    <select
                      value={question.type}
                      onChange={(event) =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          type: event.target.value,
                          options:
                            event.target.value === "Integer"
                              ? current.options
                              : current.options.length
                              ? current.options
                              : [createOption(), createOption()],
                        }))
                      }
                    >
                      <option value="MCQ">MCQ (single correct)</option>
                      <option value="MSQ">MSQ (multi correct)</option>
                      <option value="Integer">Integer</option>
                    </select>
                  </label>
                  <label>
                    Question image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          image: event.target.files?.[0] || null,
                        }))
                      }
                    />
                    {question.image && (
                      <span className="file-name">{question.image.name}</span>
                    )}
                  </label>
                </div>

                {question.type === "Integer" ? (
                  <label>
                    Correct integer answer
                    <input
                      type="number"
                      value={question.integerAnswer}
                      onChange={(event) =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          integerAnswer: event.target.value,
                        }))
                      }
                      placeholder="Enter the exact value"
                    />
                  </label>
                ) : (
                  <div className="options">
                    <div className="options__header">
                      <h4>Options</h4>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => addOption(question.id)}
                      >
                        Add option
                      </button>
                    </div>
                    {question.options.map((option, optionIndex) => (
                      <div key={option.id} className="option-row">
                        <label className="option-row__correct">
                          <input
                            type={question.type === "MCQ" ? "radio" : "checkbox"}
                            name={`correct-${question.id}`}
                            checked={option.isCorrect}
                            onChange={() =>
                              toggleCorrectOption(question.id, option.id)
                            }
                          />
                          Correct
                        </label>
                        <input
                          type="text"
                          value={option.text}
                          onChange={(event) =>
                            updateOption(question.id, option.id, (current) => ({
                              ...current,
                              text: event.target.value,
                            }))
                          }
                          placeholder={`Option ${optionIndex + 1}`}
                          required
                        />
                        <label className="file-button">
                          Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              updateOption(question.id, option.id, (current) => ({
                                ...current,
                                image: event.target.files?.[0] || null,
                              }))
                            }
                          />
                        </label>
                        {option.image && (
                          <span className="file-name">{option.image.name}</span>
                        )}
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => removeOption(question.id, option.id)}
                          disabled={question.options.length <= 2}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="question-actions">
            <button type="button" className="secondary-button" onClick={addQuestion}>
              Add question
            </button>
            <button type="submit" className="primary-button">
              Save quiz
            </button>
          </div>
        </form>

        {quizzes.length > 0 && (
          <div className="manage-league-admin__list">
            <h3>Existing quizzes</h3>
            <div className="card-grid">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="summary-card">
                  <h4>{quiz.title}</h4>
                  <p>{quiz.description || "No description"}</p>
                  <p>
                    Questions: <strong>{quiz.questions.length}</strong>
                  </p>
                  <p>
                    Duration: <strong>{quiz.durationMinutes || "N/A"} mins</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="manage-league-admin__section">
        <h2>Create League</h2>
        <form className="manage-league-admin__form" onSubmit={handleCreateLeague}>
          <div className="form-grid">
            <label>
              League name
              <input
                type="text"
                value={leagueForm.name}
                onChange={(event) => updateLeagueField("name", event.target.value)}
                placeholder="e.g. March League"
                required
              />
            </label>
            <label>
              Fee type
              <select
                value={leagueForm.feeType}
                onChange={(event) => updateLeagueField("feeType", event.target.value)}
              >
                <option value="monthly">Per month</option>
                <option value="one-time">One-time payment</option>
              </select>
            </label>
            <label>
              Fee amount
              <input
                type="number"
                min="0"
                value={leagueForm.feeAmount}
                onChange={(event) => updateLeagueField("feeAmount", event.target.value)}
                placeholder="499"
              />
            </label>
            <label>
              Quiz slot (date & time)
              <input
                type="datetime-local"
                value={leagueForm.slotDateTime}
                onChange={(event) =>
                  updateLeagueField("slotDateTime", event.target.value)
                }
              />
            </label>
            <label>
              Assign quiz
              <select
                value={leagueForm.assignedQuizId}
                onChange={(event) =>
                  updateLeagueField("assignedQuizId", event.target.value)
                }
              >
                <option value="">Select quiz</option>
                {quizOptions.map((quiz) => (
                  <option key={quiz.value} value={quiz.value}>
                    {quiz.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="primary-button">
            Save league
          </button>
        </form>

        {leagues.length > 0 && (
          <div className="manage-league-admin__list">
            <h3>Existing leagues</h3>
            <div className="card-grid">
              {leagues.map((league) => (
                <div key={league.id} className="summary-card">
                  <h4>{league.name}</h4>
                  <p>
                    Fee: <strong>{league.feeType}</strong>
                  </p>
                  <p>
                    Slot: <strong>{league.slotDateTime || "Not set"}</strong>
                  </p>
                  <p>
                    Quiz: <strong>{league.assignedQuizId || "Unassigned"}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ManageLeagueAdmin;
