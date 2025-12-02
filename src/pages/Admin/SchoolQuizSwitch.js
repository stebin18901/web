// src/components/SchoolQuizSwitch.js
import React, { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import './SchoolQuizSwitch.css';

const SchoolQuizSwitch = () => {
  const [schools, setSchools] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolChapters, setSchoolChapters] = useState([]);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState("");
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch schools and chapters from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch schools
        const schoolsSnapshot = await getDocs(collection(db, "schools"));
        const schoolsData = schoolsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSchools(schoolsData);

        // Fetch chapters
        const chaptersSnapshot = await getDocs(collection(db, "chapters"));
        const chaptersData = chaptersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setChapters(chaptersData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        setError("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load school's chapter preferences when school is selected
  useEffect(() => {
    if (selectedSchool) {
      const fetchSchoolChapters = async () => {
        try {
          setLoading(true);
          const schoolRef = doc(db, "schools", selectedSchool.id);
          const schoolDoc = await getDoc(schoolRef);
          
          if (schoolDoc.exists()) {
            setSchoolChapters(schoolDoc.data().enabledChapters || []);
          }
        } catch (error) {
          console.error("Error fetching school chapters: ", error);
          setError("Failed to load school preferences.");
        } finally {
          setLoading(false);
        }
      };
      
      fetchSchoolChapters();
    }
  }, [selectedSchool]);

  // Toggle chapter access for selected school
  const toggleChapterAccess = async (chapterId) => {
    try {
      setError(null);
      const updatedChapters = schoolChapters.includes(chapterId)
        ? schoolChapters.filter(id => id !== chapterId)
        : [...schoolChapters, chapterId];
      
      setSchoolChapters(updatedChapters);

      const schoolRef = doc(db, "schools", selectedSchool.id);
      await updateDoc(schoolRef, {
        enabledChapters: updatedChapters,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating chapter access: ", error);
      setError("Failed to update chapter access. Please try again.");
      // Revert UI state on error
      setSchoolChapters([...schoolChapters]);
    }
  };

  // Filter schools based on search query
  const filteredSchools = schools.filter(school => {
    const searchLower = schoolSearchQuery.toLowerCase();
    return (
      school.schoolName.toLowerCase().includes(searchLower) ||
      school.schoolId.toLowerCase().includes(searchLower)
    );
  });

  // Filter chapters based on search query
  const filteredChapters = chapters.filter(chapter => {
    const searchLower = chapterSearchQuery.toLowerCase();
    return (
      chapter.chapterName.toLowerCase().includes(searchLower) ||
      chapter.subject.toLowerCase().includes(searchLower) ||
      chapter.class.toString().includes(chapterSearchQuery)
    );
  });

  if (loading && !selectedSchool) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading schools and chapters...</p>
      </div>
    );
  }

  return (
    <div className="school-quiz-container">
      <h2 className="page-title">Manage School Chapter Access</h2>
      {error && <div className="error-message">{error}</div>}

      {/* School Search and Selection */}
      <div className="school-selection card">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search schools by name or ID..."
            value={schoolSearchQuery}
            onChange={(e) => setSchoolSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {filteredSchools.length > 0 ? (
          <div className="school-list">
            {filteredSchools.map(school => (
              <div 
                key={school.id} 
                className={`school-item ${selectedSchool?.id === school.id ? 'selected' : ''}`}
                onClick={() => setSelectedSchool(school)}
              >
                <div className="school-info">
                  <h3 className="school-name">{school.schoolName}</h3>
                  <p className="school-id">{school.schoolId}</p>
                </div>
                {selectedSchool?.id === school.id && (
                  <div className="selected-indicator">✓</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-results">
            <p>No schools found matching your search.</p>
          </div>
        )}
      </div>

      {/* Chapter List for Selected School */}
      {selectedSchool && (
        <div className="chapter-access card">
          <div className="section-header">
            <h3>Chapter Access for: {selectedSchool.schoolName}</h3>
            {loading && <div className="mini-spinner"></div>}
          </div>
          
          {/* Chapter Search */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Search chapters by name, subject, or class..."
              value={chapterSearchQuery}
              onChange={(e) => setChapterSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>

          {filteredChapters.length > 0 ? (
            <div className="table-container">
              <table className="chapter-table">
                <thead>
                  <tr>
                    <th>Chapter Name</th>
                    <th>Subject</th>
                    <th>Class</th>
                    <th>Access</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChapters.map(chapter => (
                    <tr key={chapter.id}>
                      <td className="chapter-name">{chapter.chapterName}</td>
                      <td className="subject">{chapter.subject}</td>
                      <td className="class">Grade {chapter.class}</td>
                      <td className="toggle-cell">
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={schoolChapters.includes(chapter.id)}
                            onChange={() => toggleChapterAccess(chapter.id)}
                            disabled={loading}
                          />
                          <span className="slider round"></span>
                        </label>
                      </td>
                      <td className="status-cell">
                        <span className={`status ${schoolChapters.includes(chapter.id) ? 'enabled' : 'disabled'}`}>
                          {schoolChapters.includes(chapter.id) ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-results">
              <p>No chapters found matching your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolQuizSwitch;