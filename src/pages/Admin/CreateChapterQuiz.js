import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, addDoc, query, where, getDocs, orderBy, } from "firebase/firestore"; 
import "./CreateChapterQuiz.css"; 

const CreateChapterQuiz = () => { 
    const [selectedClass, setSelectedClass] = useState(6); 
    const [subject, setSubject] = useState(""); 
    const [chapter, setChapter] = useState(""); 
    const [quizData, setQuizData] = useState(""); 
    const [isJsonValid, setIsJsonValid] = useState(true); 
    const [availableChapters, setAvailableChapters] = useState([]); 
    const [isLoadingChapters, setIsLoadingChapters] = useState(false); 
    const [quizzes, setQuizzes] = useState([]); 
    const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false); 
    const [filterClass, setFilterClass] = useState(""); 
    const [filterSubject, setFilterSubject] = useState(""); 
    const [selectedQuiz, setSelectedQuiz] = useState(null); // for modal 

    // Fetch chapters based on selected class and subject
    useEffect(() => { 
        const fetchChapters = async () => { 
            if (!subject) { 
                setAvailableChapters([]); 
                return; 
            } 
            setIsLoadingChapters(true); 
            try { 
                const q = query( 
                    collection(db, "chapters"), 
                    where("class", "==", selectedClass), 
                    where("subject", "==", subject) 
                ); 
                const querySnapshot = await getDocs(q); 
                const chapters = []; 
                querySnapshot.forEach((doc) => { 
                    chapters.push(doc.data().chapterName); 
                }); 
                setAvailableChapters(chapters); 
            } catch (error) { 
                console.error("Error fetching chapters:", error); 
                alert("Failed to load chapters"); 
            } finally { 
                setIsLoadingChapters(false); 
            } 
        }; 
        fetchChapters(); 
    }, [selectedClass, subject]); 

    // Fetch quizzes based on filters
    useEffect(() => { 
        const fetchQuizzes = async () => { 
            setIsLoadingQuizzes(true); 
            try { 
                let q = query(collection(db, "quizzes"), orderBy("createdAt", "desc")); 
                if (filterClass) { 
                    q = query(q, where("class", "==", parseInt(filterClass))); 
                } 
                if (filterSubject) { 
                    q = query(q, where("subject", "==", filterSubject)); 
                } 
                const querySnapshot = await getDocs(q); 
                const quizzesData = []; 
                querySnapshot.forEach((doc) => { 
                    quizzesData.push({ 
                        id: doc.id, 
                        ...doc.data(), 
                        createdAt: doc.data().createdAt?.toDate()?.toLocaleString() || "N/A", 
                    }); 
                }); 
                setQuizzes(quizzesData); 
            } catch (error) { 
                console.error("Error fetching quizzes:", error); 
                alert("Failed to load quizzes"); 
            } finally { 
                setIsLoadingQuizzes(false); 
            } 
        }; 
        fetchQuizzes(); 
    }, [filterClass, filterSubject]); 

    // Validate JSON input
    useEffect(() => { 
        if (!quizData) { 
            setIsJsonValid(true); 
            return; 
        } 
        try { 
            JSON.parse(quizData); 
            setIsJsonValid(true); 
        } catch (e) { 
            setIsJsonValid(false); 
        } 
    }, [quizData]); 

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        if (!subject || !chapter || !quizData) { 
            alert("Please fill all fields"); 
            return; 
        } 
        if (!isJsonValid) { 
            alert("Please enter valid JSON for quiz data"); 
            return; 
        } 
        try { 
            const parsedQuizData = JSON.parse(quizData); 
            await addDoc(collection(db, "quizzes"), { 
                class: selectedClass, 
                subject, 
                chapter, 
                quizData: parsedQuizData, 
                createdAt: new Date(), 
            }); 
            alert("Quiz created successfully!"); 
            setQuizData(""); 
            setFilterClass(selectedClass.toString()); 
            setFilterSubject(subject); 
        } catch (error) { 
            console.error("Error adding quiz:", error); 
            alert("Failed to create quiz. Please try again."); 
        } 
    }; 

    return ( 
        <div className="create-quiz-container"> 
            <h1>Create Chapter Quiz</h1> 
            <div className="quiz-admin-layout"> 
                {/* Left Form */} 
                <div className="quiz-creation-section"> 
                    <form onSubmit={handleSubmit}> 
                        <div className="form-group"> 
                            <label>Class:</label> 
                            <select 
                                value={selectedClass} 
                                onChange={(e) => setSelectedClass(parseInt(e.target.value))} 
                                required 
                            > 
                                {[6, 7, 8, 9, 10].map((grade) => ( 
                                    <option key={grade} value={grade}> 
                                        Class {grade} 
                                    </option> 
                                ))} 
                            </select> 
                        </div> 
                        <div className="form-group"> 
                            <label>Subject:</label> 
                            <select 
                                value={subject} 
                                onChange={(e) => { 
                                    setSubject(e.target.value); 
                                    setChapter(""); 
                                }} 
                                required 
                            > 
                                <option value="">Select Subject</option> 
                                {["Mathematics", "Physics", "Chemistry", "Biology", "Social Studies"].map( 
                                    (sub) => ( 
                                        <option key={sub} value={sub}> 
                                            {sub} 
                                        </option> 
                                    ) 
                                )} 
                            </select> 
                        </div> 
                        <div className="form-group"> 
                            <label>Chapter:</label> 
                            {isLoadingChapters ? ( 
                                <p>Loading chapters...</p> 
                            ) : ( 
                                <select 
                                    value={chapter} 
                                    onChange={(e) => setChapter(e.target.value)} 
                                    required 
                                    disabled={!subject || availableChapters.length === 0} 
                                > 
                                    <option value="">Select Chapter</option> 
                                    {availableChapters.map((chap) => ( 
                                        <option key={chap} value={chap}> 
                                            {chap} 
                                        </option> 
                                    ))} 
                                </select> 
                            )} 
                            {subject && availableChapters.length === 0 && !isLoadingChapters && ( 
                                <p className="warning">No chapters found for this subject</p> 
                            )} 
                        </div> 
                        <div className="form-group"> 
                            <label>Quiz Data (JSON format):</label> 
                            <textarea 
                                value={quizData} 
                                onChange={(e) => setQuizData(e.target.value)} 
                                placeholder="Enter quiz data in JSON format..." 
                                rows={12} 
                                required 
                            /> 
                            {!isJsonValid && ( 
                                <p className="error">Invalid JSON format. Please check your input.</p> 
                            )} 
                        </div> 
                        <button type="submit" disabled={!isJsonValid}> 
                            Create Quiz 
                        </button> 
                    </form> 
                </div> 

                {/* Right List */} 
                <div className="quiz-listing-section"> 
                    <h2>Existing Quizzes</h2> 
                    <div className="quiz-filters"> 
                        <div className="filter-group"> 
                            <label>Filter by Class:</label> 
                            <select 
                                value={filterClass} 
                                onChange={(e) => setFilterClass(e.target.value)} 
                            > 
                                <option value="">All Classes</option> 
                                {[6, 7, 8, 9, 10].map((grade) => ( 
                                    <option key={grade} value={grade}> 
                                        Class {grade} 
                                    </option> 
                                ))} 
                            </select> 
                        </div> 
                        <div className="filter-group"> 
                            <label>Filter by Subject:</label> 
                            <select 
                                value={filterSubject} 
                                onChange={(e) => setFilterSubject(e.target.value)} 
                            > 
                                <option value="">All Subjects</option> 
                                {["Mathematics", "Physics", "Chemistry", "Biology", "Social Studies"].map( 
                                    (sub) => ( 
                                        <option key={sub} value={sub}> 
                                            {sub} 
                                        </option> 
                                    ) 
                                )} 
                            </select> 
                        </div> 
                    </div> 
                    {isLoadingQuizzes ? ( 
                        <p>Loading quizzes...</p> 
                    ) : quizzes.length === 0 ? ( 
                        <p>No quizzes found</p> 
                    ) : ( 
                        <div className="quizzes-list"> 
                            {quizzes.map((quiz) => ( 
                                <div key={quiz.id} className="quiz-card"> 
                                    <h3>{quiz.quizData?.quizTitle || "Untitled Quiz"}</h3> 
                                    <div className="quiz-meta"> 
                                        <span>Class: {quiz.class}</span> 
                                        <span>Subject: {quiz.subject}</span> 
                                        <span>Chapter: {quiz.chapter}</span> 
                                        <span>Created: {quiz.createdAt}</span> 
                                    </div> 
                                    <div className="quiz-stats"> 
                                        <span>Questions: {quiz.quizData?.questions?.length || 0}</span> 
                                    </div> 
                                    <button 
                                        className="view-quiz-btn" 
                                        onClick={() => setSelectedQuiz(quiz)} 
                                    > 
                                        View Quiz 
                                    </button> 
                                </div> 
                            ))} 
                        </div> 
                    )} 
                </div> 
            </div> 

            {/* Modal Preview */} 
            {selectedQuiz && ( 
                <div className="modal-backdrop" onClick={() => setSelectedQuiz(null)}> 
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}> 
                        <h2>{selectedQuiz.quizData?.quizTitle || "Untitled Quiz"}</h2> 
                        <p><strong>Class:</strong> {selectedQuiz.class}</p> 
                        <p><strong>Subject:</strong> {selectedQuiz.subject}</p> 
                        <p><strong>Chapter:</strong> {selectedQuiz.chapter}</p> 
                        <p><strong>Created:</strong> {selectedQuiz.createdAt}</p> 
                        <hr /> 
                        {selectedQuiz.quizData?.questions?.map((q, index) => ( 
                            <div key={index}> 
                                <p><strong>Q{index + 1}:</strong> {q.question}</p> 
                                <ul> 
                                    {q.options?.map((opt, idx) => ( 
                                        <li key={idx}>{opt}</li> 
                                    ))} 
                                </ul> 
                                <p><strong>Answer:</strong> {q.answer}</p> 
                                <hr /> 
                            </div> 
                        ))} 
                        <button onClick={() => setSelectedQuiz(null)}>Close</button> 
                    </div> 
                </div> 
            )} 
        </div> 
    ); 
}; 

export default CreateChapterQuiz;