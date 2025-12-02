import { useState } from 'react';
import { db, storage } from '../../firebase/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './CreateQuiz.css';

const CreateQuiz = () => {
  const [quizData, setQuizData] = useState({
    subject: '',
    class: '',
    chapter: '',
    questions: [{
      text: '',
      type: 'MCQ',
      options: ['', ''],
      correctAnswer: null,
      notes: '',
      questionImage: null,
      optionImages: [null, null],
      notesImage: null
    }]
  });

  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuizData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const uploadFile = async (file, path) => {
    if (!file) return null;
    
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleFileUpload = async (e, qIndex, field, oIndex = null) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(prev => ({ ...prev, [`${qIndex}-${field}`]: 'Uploading...' }));

    try {
      let path = `quizzes/${Date.now()}-${file.name}`;
      const url = await uploadFile(file, path);

      const updatedQuestions = [...quizData.questions];
      
      if (field === 'questionImage') {
        updatedQuestions[qIndex].questionImage = url;
      } else if (field === 'notesImage') {
        updatedQuestions[qIndex].notesImage = url;
      } else if (field === 'optionImage' && oIndex !== null) {
        if (!updatedQuestions[qIndex].optionImages) {
          updatedQuestions[qIndex].optionImages = [];
        }
        updatedQuestions[qIndex].optionImages[oIndex] = url;
      }

      setQuizData(prev => ({
        ...prev,
        questions: updatedQuestions
      }));

      setUploadProgress(prev => ({ ...prev, [`${qIndex}-${field}`]: 'Uploaded!' }));
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(prev => ({ ...prev, [`${qIndex}-${field}`]: 'Upload failed' }));
    } finally {
      setIsUploading(false);
      // Clear progress message after 3 seconds
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[`${qIndex}-${field}`];
          return newProgress;
        });
      }, 3000);
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[index][field] = value;

    if (field === 'type') {
      switch (value) {
        case 'checkbox':
          updatedQuestions[index].correctAnswer = [];
          updatedQuestions[index].options = ['', ''];
          updatedQuestions[index].optionImages = [null, null];
          break;
        case 'truefalse':
          updatedQuestions[index].correctAnswer = 0;
          updatedQuestions[index].options = ['True', 'False'];
          updatedQuestions[index].optionImages = [null, null];
          break;
        case 'shortanswer':
          updatedQuestions[index].correctAnswer = '';
          updatedQuestions[index].options = [];
          updatedQuestions[index].optionImages = [];
          break;
        default: // MCQ
          updatedQuestions[index].correctAnswer = null;
          updatedQuestions[index].options = ['', ''];
          updatedQuestions[index].optionImages = [null, null];
      }
    }

    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[qIndex].options[oIndex] = value;
    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const addQuestion = () => {
    setQuizData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          text: '',
          type: 'MCQ',
          options: ['', ''],
          correctAnswer: null,
          notes: '',
          questionImage: null,
          optionImages: [null, null],
          notesImage: null
        }
      ]
    }));
  };

  const removeQuestion = (index) => {
    if (quizData.questions.length <= 1) return;
    const updatedQuestions = [...quizData.questions];
    updatedQuestions.splice(index, 1);
    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const addOption = (qIndex) => {
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[qIndex].options.push('');
    updatedQuestions[qIndex].optionImages.push(null);
    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const removeOption = (qIndex, oIndex) => {
    const updatedQuestions = [...quizData.questions];
    if (updatedQuestions[qIndex].options.length <= 2) return;
    updatedQuestions[qIndex].options.splice(oIndex, 1);
    updatedQuestions[qIndex].optionImages.splice(oIndex, 1);

    const correctAnswer = updatedQuestions[qIndex].correctAnswer;
    if (Array.isArray(correctAnswer)) {
      updatedQuestions[qIndex].correctAnswer = correctAnswer.filter(i => i !== oIndex).map(i => (i > oIndex ? i - 1 : i));
    } else if (correctAnswer === oIndex) {
      updatedQuestions[qIndex].correctAnswer = null;
    } else if (correctAnswer > oIndex) {
      updatedQuestions[qIndex].correctAnswer -= 1;
    }

    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const setCorrectAnswer = (qIndex, answerIndex, isChecked = true) => {
    const updatedQuestions = [...quizData.questions];
    const question = updatedQuestions[qIndex];

    if (question.type === 'checkbox') {
      const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
      if (isChecked) {
        if (!current.includes(answerIndex)) current.push(answerIndex);
      } else {
        updatedQuestions[qIndex].correctAnswer = current.filter(i => i !== answerIndex);
        setQuizData(prev => ({ ...prev, questions: updatedQuestions }));
        return;
      }
      updatedQuestions[qIndex].correctAnswer = [...new Set(current)];
    } else {
      updatedQuestions[qIndex].correctAnswer = answerIndex;
    }

    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const removeImage = (qIndex, field, oIndex = null) => {
    const updatedQuestions = [...quizData.questions];
    
    if (field === 'questionImage') {
      updatedQuestions[qIndex].questionImage = null;
    } else if (field === 'notesImage') {
      updatedQuestions[qIndex].notesImage = null;
    } else if (field === 'optionImage' && oIndex !== null) {
      updatedQuestions[qIndex].optionImages[oIndex] = null;
    }

    setQuizData(prev => ({
      ...prev,
      questions: updatedQuestions
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) {
      alert('Please wait for all files to finish uploading');
      return;
    }

    try {
      if (!quizData.subject || !quizData.class || !quizData.chapter) {
        alert('Please fill in all quiz details');
        return;
      }

      for (const [qIndex, question] of quizData.questions.entries()) {
        if (!question.text && !question.questionImage) {
          alert(`Please enter text or upload an image for question ${qIndex + 1}`);
          return;
        }

        if (question.type === 'checkbox') {
          if (!Array.isArray(question.correctAnswer) || question.correctAnswer.length === 0) {
            alert(`Please select at least one correct answer for question ${qIndex + 1}`);
            return;
          }
        } else if (question.type === 'shortanswer') {
          if (!question.correctAnswer || question.correctAnswer.trim() === '') {
            alert(`Please provide correct answer for question ${qIndex + 1}`);
            return;
          }
        } else {
          if (question.correctAnswer === null || question.correctAnswer === undefined) {
            alert(`Please select correct answer for question ${qIndex + 1}`);
            return;
          }
        }

        if (question.type !== 'shortanswer') {
          for (const [oIndex, option] of question.options.entries()) {
            if (!option && !(question.optionImages && question.optionImages[oIndex])) {
              alert(`Please fill in or upload an image for option ${oIndex + 1} in question ${qIndex + 1}`);
              return;
            }
          }
        }
      }

      const docRef = await addDoc(collection(db, 'quizzes'), {
        ...quizData,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      });

      alert('Quiz created successfully!');
      console.log('Quiz added with ID: ', docRef.id);

      setQuizData({
        subject: '',
        class: '',
        chapter: '',
        questions: [{
          text: '',
          type: 'MCQ',
          options: ['', ''],
          correctAnswer: null,
          notes: '',
          questionImage: null,
          optionImages: [null, null],
          notesImage: null
        }]
      });
    } catch (error) {
      console.error('Error adding quiz: ', error);
      alert('Error creating quiz');
    }
  };

  return (
    <div className="quiz-creation-container">
      <h1>Create New Quiz</h1>
      <form onSubmit={handleSubmit}>
        <div className="quiz-meta-fields">
          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              name="subject"
              value={quizData.subject}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select
              name="class"
              value={quizData.class}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Class</option>
              <option value="6">Grade 6</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
              <option value="9">Grade 9</option>
            </select>
          </div>

          <div className="form-group">
            <label>Chapter</label>
            <input
              type="text"
              name="chapter"
              value={quizData.chapter}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="questions-container">
          {quizData.questions.map((question, qIndex) => (
            <div key={qIndex} className="question-card">
              <div className="question-header">
                <h3>Question {qIndex + 1}</h3>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeQuestion(qIndex)}
                  disabled={quizData.questions.length <= 1}
                >
                  −
                </button>
              </div>

              <div className="question-content">
                <div className="form-group">
                  <label>Question Text</label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
                  />
                  <div className="file-upload-container">
                    <label className="file-upload-label">
                      {question.questionImage ? 'Replace Image' : 'IMG+'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, qIndex, 'questionImage')}
                        hidden
                      />
                    </label>
                    {question.questionImage && (
                      <>
                        <div className="image-preview-container">
                          <img src={question.questionImage} alt="Question" className="image-preview" />
                          <button
                            type="button"
                            className="remove-image-btn"
                            onClick={() => removeImage(qIndex, 'questionImage')}
                          >
                            ×
                          </button>
                        </div>
                        <div className="upload-progress">
                          {uploadProgress[`${qIndex}-questionImage`]}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Question Type</label>
                  <select
                    value={question.type}
                    onChange={(e) => handleQuestionChange(qIndex, 'type', e.target.value)}
                    required
                  >
                    <option value="MCQ">Multiple Choice (Single Answer)</option>
                    <option value="checkbox">Multiple Choice (Multiple Answers)</option>
                    <option value="truefalse">True/False</option>
                    <option value="shortanswer">Short Answer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notes/Concept</label>
                  <textarea
                    value={question.notes}
                    onChange={(e) => handleQuestionChange(qIndex, 'notes', e.target.value)}
                    placeholder="Add any notes or concepts related to this question"
                  />
                  <div className="file-upload-container">
                    <label className="file-upload-label">
                      {question.notesImage ? 'Replace Image' : 'IMG+'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, qIndex, 'notesImage')}
                        hidden
                      />
                    </label>
                    {question.notesImage && (
                      <>
                        <div className="image-preview-container">
                          <img src={question.notesImage} alt="Notes" className="image-preview" />
                          <button
                            type="button"
                            className="remove-image-btn"
                            onClick={() => removeImage(qIndex, 'notesImage')}
                          >
                            ×
                          </button>
                        </div>
                        <div className="upload-progress">
                          {uploadProgress[`${qIndex}-notesImage`]}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {question.type === 'shortanswer' ? (
                  <div className="form-group">
                    <label>Correct Answer</label>
                    <input
                      type="text"
                      value={question.correctAnswer || ''}
                      onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div className="options-container">
                    <label>Options</label>
                    {question.options.map((option, oIndex) => (
                      <div key={oIndex} className="option-row">
                        <div className="option-input">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                            disabled={question.type === 'truefalse'}
                          />
                          <div className="file-upload-container">
                            <label className="file-upload-label">
                              {question.optionImages?.[oIndex] ? 'Replace Image' : 'IMG+'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, qIndex, 'optionImage', oIndex)}
                                hidden
                              />
                            </label>
                            {question.optionImages?.[oIndex] && (
                              <>
                                <div className="image-preview-container">
                                  <img src={question.optionImages[oIndex]} alt={`Option ${oIndex + 1}`} className="image-preview" />
                                  <button
                                    type="button"
                                    className="remove-image-btn"
                                    onClick={() => removeImage(qIndex, 'optionImage', oIndex)}
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="upload-progress">
                                  {uploadProgress[`${qIndex}-optionImage-${oIndex}`]}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="option-actions">
                          {question.type === 'checkbox' ? (
                            <label className="correct-answer-label">
                              <input
                                type="checkbox"
                                checked={question.correctAnswer?.includes(oIndex)}
                                onChange={(e) =>
                                  setCorrectAnswer(qIndex, oIndex, e.target.checked)
                                }
                              />
                              <span>Correct</span>
                            </label>
                          ) : (
                            <label className="correct-answer-label">
                              <input
                                type="radio"
                                name={`correct-answer-${qIndex}`}
                                checked={question.correctAnswer === oIndex}
                                onChange={() => setCorrectAnswer(qIndex, oIndex)}
                              />
                              <span>Correct</span>
                            </label>
                          )}

                          {question.type !== 'truefalse' && (
                            <button
                              type="button"
                              className="remove-btn small"
                              onClick={() => removeOption(qIndex, oIndex)}
                              disabled={question.options.length <= 2}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {question.type !== 'truefalse' && (
                      <button
                        type="button"
                        className="add-option-btn"
                        onClick={() => addOption(qIndex)}
                      >
                        + Add Option
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="add-question-btn" onClick={addQuestion}>
            + Add Question
          </button>
          <button type="submit" className="submit-btn" disabled={isUploading}>
            {isUploading ? 'Creating Quiz...' : 'Create Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;