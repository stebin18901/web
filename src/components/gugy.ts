<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quiz Reports System</title>
    <style>
        /* [Previous CSS remains exactly the same] */
    </style>
</head>
<body>
    <div class="container">
        <!-- [Previous HTML remains exactly the same until the script section] -->
    </div>

    <script>
        // Enhanced sample data with consistent IDs
        const classes = {
            'class1': {
                name: 'Class 1 - Mathematics',
                students: [
                    { id: 'student1', name: 'John Doe' },
                    { id: 'student2', name: 'Jane Smith' },
                    { id: 'student3', name: 'Michael Johnson' },
                    { id: 'student4', name: 'Emily Davis' }
                ]
            },
            'class2': {
                name: 'Class 2 - Science',
                students: [
                    { id: 'student5', name: 'Robert Brown' },
                    { id: 'student6', name: 'Sarah Wilson' }
                ]
            }
        };

        const studentQuizzes = {
            'student1': [
                {
                    id: 'quiz1',
                    title: 'Mathematics: Algebra Basics',
                    date: '2023-05-15',
                    score: 85,
                    correct: 17,
                    wrong: 3,
                    concepts: ['Variables', 'Equations', 'Expressions']
                },
                {
                    id: 'quiz2',
                    title: 'Mathematics: Geometry Fundamentals',
                    date: '2023-06-02',
                    score: 72,
                    correct: 18,
                    wrong: 7,
                    concepts: ['Angles', 'Shapes', 'Area']
                }
            ],
            'student2': [
                {
                    id: 'quiz3',
                    title: 'Mathematics: Algebra Basics',
                    date: '2023-05-15',
                    score: 92,
                    correct: 23,
                    wrong: 2,
                    concepts: ['Variables', 'Equations', 'Expressions']
                }
            ],
            'student5': [
                {
                    id: 'quiz4',
                    title: 'Science: Physics Basics',
                    date: '2023-05-10',
                    score: 78,
                    correct: 19,
                    wrong: 6,
                    concepts: ['Motion', 'Forces', 'Energy']
                }
            ]
        };

        // DOM elements
        const classSelect = document.getElementById('class-select');
        const studentListContainer = document.getElementById('student-list-container');
        const studentList = document.getElementById('student-list');
        const classSelectionView = document.getElementById('class-selection-view');
        const studentQuizView = document.getElementById('student-quiz-view');
        const backToClassesBtn = document.getElementById('back-to-classes');
        const studentNameHeader = document.getElementById('student-name-header');
        const quizList = document.getElementById('quiz-list');
        const generateReportBtn = document.getElementById('generate-report-btn');
        const reportCardContainer = document.getElementById('report-card-container');
        const reportStudentName = document.getElementById('report-student-name');
        const reportClassName = document.getElementById('report-class-name');
        const reportDate = document.getElementById('report-date');
        const totalQuizzes = document.getElementById('total-quizzes');
        const averageScore = document.getElementById('average-score');
        const bestScore = document.getElementById('best-score');
        const weakAreas = document.getElementById('weak-areas');
        const printReportBtn = document.getElementById('print-report-btn');
        const downloadPdfBtn = document.getElementById('download-pdf-btn');

        // Current state
        let currentClass = null;
        let currentStudent = null;

        // Initialize the app
        document.addEventListener('DOMContentLoaded', () => {
            console.log('System initialized');
            
            // Event listeners
            classSelect.addEventListener('change', handleClassSelect);
            backToClassesBtn.addEventListener('click', goBackToClasses);
            generateReportBtn.addEventListener('click', generateReport);
            printReportBtn.addEventListener('click', printReport);
            downloadPdfBtn.addEventListener('click', downloadPdf);
        });

        function handleClassSelect(e) {
            const classId = e.target.value;
            console.log('Class selected:', classId);
            
            if (!classId) {
                studentListContainer.classList.add('hidden');
                return;
            }

            currentClass = classes[classId];
            if (!currentClass) {
                console.error('Class not found:', classId);
                return;
            }

            console.log('Found class:', currentClass.name);
            renderStudentList(currentClass.students);
            studentListContainer.classList.remove('hidden');
        }

        function renderStudentList(students) {
            console.log('Rendering students:', students);
            studentList.innerHTML = '';
            
            if (!students || students.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No students in this class';
                studentList.appendChild(li);
                return;
            }
            
            students.forEach(student => {
                const li = document.createElement('li');
                li.textContent = student.name;
                li.dataset.studentId = student.id;
                li.addEventListener('click', () => {
                    console.log('Student clicked:', student.id);
                    showStudentQuizzes(student);
                });
                studentList.appendChild(li);
            });
        }

        function showStudentQuizzes(student) {
            if (!student) {
                console.error('No student provided');
                return;
            }

            currentStudent = student;
            console.log('Showing quizzes for:', student.id);
            
            classSelectionView.classList.add('hidden');
            studentQuizView.classList.remove('hidden');
            
            studentNameHeader.textContent = `${student.name}'s Quiz Attempts`;
            renderQuizList(student.id);
            
            reportCardContainer.classList.add('hidden');
        }

        function renderQuizList(studentId) {
            console.log('Rendering quizzes for student:', studentId);
            quizList.innerHTML = '';
            
            const quizzes = studentQuizzes[studentId] || [];
            console.log('Found quizzes:', quizzes);
            
            if (quizzes.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No quizzes attempted yet';
                quizList.appendChild(li);
                return;
            }
            
            quizzes.forEach(quiz => {
                const li = document.createElement('li');
                
                const quizHeader = document.createElement('div');
                quizHeader.style.display = 'flex';
                quizHeader.style.justifyContent = 'space-between';
                quizHeader.style.alignItems = 'center';
                
                const quizTitle = document.createElement('h4');
                quizTitle.textContent = quiz.title;
                
                const quizDate = document.createElement('span');
                quizDate.textContent = `Attempted: ${quiz.date}`;
                quizDate.style.color = '#666';
                quizDate.style.fontSize = '0.9em';
                
                quizHeader.appendChild(quizTitle);
                quizHeader.appendChild(quizDate);
                
                li.appendChild(quizHeader);
                
                const quizDetails = document.createElement('div');
                quizDetails.className = 'quiz-details';
                
                const scoreClass = quiz.score >= 80 ? 'high-score' : 
                                  quiz.score >= 50 ? 'medium-score' : 'low-score';
                
                quizDetails.innerHTML = `
                    <p><strong>Score:</strong> <span class="score ${scoreClass}">${quiz.score}%</span></p>
                    <p><strong>Correct Answers:</strong> ${quiz.correct}</p>
                    <p><strong>Wrong Answers:</strong> ${quiz.wrong}</p>
                    <p><strong>Concepts Tested:</strong> ${quiz.concepts.join(', ')}</p>
                `;
                
                li.appendChild(quizDetails);
                quizList.appendChild(li);
            });
        }

        function goBackToClasses() {
            console.log('Going back to class selection');
            studentQuizView.classList.add('hidden');
            classSelectionView.classList.remove('hidden');
            currentStudent = null;
        }

        function generateReport() {
            if (!currentStudent) {
                console.error('No student selected');
                return;
            }
            
            console.log('Generating report for:', currentStudent.id);
            const quizzes = studentQuizzes[currentStudent.id] || [];
            console.log('Quizzes found:', quizzes);
            
            const total = quizzes.length;
            const scores = quizzes.map(q => q.score);
            const avgScore = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
            const maxScore = total > 0 ? Math.max(...scores) : 0;
            
            // Find weak areas
            const conceptScores = {};
            const conceptAttempts = {};
            
            quizzes.forEach(quiz => {
                quiz.concepts.forEach(concept => {
                    if (!conceptScores[concept]) {
                        conceptScores[concept] = 0;
                        conceptAttempts[concept] = 0;
                    }
                    conceptScores[concept] += quiz.score;
                    conceptAttempts[concept] += 1;
                });
            });
            
            const weakAreasList = [];
            for (const concept in conceptScores) {
                const avgConceptScore = conceptScores[concept] / conceptAttempts[concept];
                if (avgConceptScore < 50) {
                    weakAreasList.push(concept);
                }
            }
            
            // Update report card
            reportStudentName.textContent = currentStudent.name;
            reportClassName.textContent = currentClass.name;
            reportDate.textContent = new Date().toLocaleDateString();
            totalQuizzes.textContent = total;
            averageScore.textContent = `${avgScore}%`;
            bestScore.textContent = `${maxScore}%`;
            
            // Update weak areas
            weakAreas.innerHTML = '';
            if (weakAreasList.length === 0) {
                weakAreas.innerHTML = '<p>No weak areas identified</p>';
            } else {
                weakAreas.innerHTML = '<p>Concepts needing improvement:</p>';
                weakAreasList.forEach(concept => {
                    const span = document.createElement('span');
                    span.className = 'weak-area';
                    span.textContent = concept;
                    weakAreas.appendChild(span);
                });
            }
            
            reportCardContainer.classList.remove('hidden');
            console.log('Report generated successfully');
        }

        function printReport() {
            console.log('Printing report');
            window.print();
        }

        function downloadPdf() {
            console.log('PDF download requested');
            alert('PDF generation would be implemented here with a library like jsPDF');
        }
    </script>
</body>
</html>