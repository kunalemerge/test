import { useState, useEffect } from "react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch notes on component mount
  useEffect(() => {
    fetchNotes();
  }, []);

  // Search notes when searchTerm changes
  useEffect(() => {
    if (searchTerm === "") {
      setSearchResults(notes);
    } else {
      const results = notes.filter(
        note =>
          note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setSearchResults(results);
    }
  }, [searchTerm, notes]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/notes`);
      if (!response.ok) {
        throw new Error(`Error fetching notes: ${response.statusText}`);
      }
      const data = await response.json();
      setNotes(data);
      setSearchResults(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
      setError("Failed to load notes. Please try again later.");
      setLoading(false);
    }
  };

  const createNote = async () => {
    try {
      const tagArray = tags.split(",").map(tag => tag.trim()).filter(tag => tag !== "");
      
      const response = await fetch(`${BACKEND_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          tags: tagArray,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error creating note: ${response.statusText}`);
      }

      const newNote = await response.json();
      setNotes([newNote, ...notes]);
      resetForm();
    } catch (err) {
      console.error("Failed to create note:", err);
      setError("Failed to create note. Please try again.");
    }
  };

  const updateNote = async () => {
    if (!activeNote) return;

    try {
      const tagArray = tags.split(",").map(tag => tag.trim()).filter(tag => tag !== "");
      
      const response = await fetch(`${BACKEND_URL}/api/notes/${activeNote.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          tags: tagArray,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error updating note: ${response.statusText}`);
      }

      const updatedNote = await response.json();
      setNotes(
        notes.map(note => (note.id === activeNote.id ? updatedNote : note))
      );
      setActiveNote(updatedNote);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update note:", err);
      setError("Failed to update note. Please try again.");
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Error deleting note: ${response.statusText}`);
      }

      setNotes(notes.filter(note => note.id !== id));
      if (activeNote && activeNote.id === id) {
        setActiveNote(null);
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
      setError("Failed to delete note. Please try again.");
    }
  };

  const selectNote = (note) => {
    setActiveNote(note);
    setIsEditing(false);
  };

  const startEditing = (note = null) => {
    if (note) {
      setActiveNote(note);
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags.join(", "));
    } else {
      resetForm();
      setActiveNote(null);
    }
    setIsEditing(true);
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setTags("");
    setActiveNote(null);
    setIsEditing(false);
  };

  const formatDate = (dateString) => {
    const options = { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Render functions
  const renderNotesList = () => (
    <div className="notes-list">
      <div className="list-header">
        <h2>My Notes</h2>
        <button onClick={() => startEditing()} className="btn-new">
          + New Note
        </button>
      </div>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {loading ? (
        <div className="loading">Loading notes...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : searchResults.length === 0 ? (
        <div className="no-notes">
          {searchTerm 
            ? "No notes match your search." 
            : "No notes yet. Create your first note!"}
        </div>
      ) : (
        <div className="notes-grid">
          {searchResults.map((note) => (
            <div
              key={note.id}
              className={`note-card ${activeNote && activeNote.id === note.id ? "active" : ""}`}
              onClick={() => selectNote(note)}
            >
              <h3 className="note-title">{note.title}</h3>
              <p className="note-preview">
                {note.content.substring(0, 100)}
                {note.content.length > 100 ? "..." : ""}
              </p>
              <div className="note-footer">
                <span className="note-date">
                  {formatDate(note.updated_at)}
                </span>
                {note.tags.length > 0 && (
                  <div className="note-tags">
                    {note.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="note-tag">
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && <span className="note-tag">+{note.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNoteView = () => {
    if (!activeNote) return null;

    return (
      <div className="note-view">
        <div className="note-view-header">
          <h2>{activeNote.title}</h2>
          <div className="note-actions">
            <button onClick={() => startEditing(activeNote)} className="btn-edit">
              Edit
            </button>
            <button onClick={() => deleteNote(activeNote.id)} className="btn-delete">
              Delete
            </button>
          </div>
        </div>
        
        <div className="note-dates">
          <span>Created: {formatDate(activeNote.created_at)}</span>
          <span>Updated: {formatDate(activeNote.updated_at)}</span>
        </div>
        
        {activeNote.tags.length > 0 && (
          <div className="tags-container">
            {activeNote.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="note-content">
          {activeNote.content.split("\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    );
  };

  const renderNoteForm = () => (
    <div className="note-form">
      <h2>{activeNote ? "Edit Note" : "Create New Note"}</h2>
      <div className="form-group">
        <label htmlFor="title">Title</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here..."
          rows="10"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="tags">Tags (comma separated)</label>
        <input
          type="text"
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="work, personal, ideas"
        />
      </div>
      <div className="form-actions">
        <button 
          onClick={activeNote ? updateNote : createNote} 
          className="btn-save"
          disabled={!title || !content}
        >
          {activeNote ? "Update Note" : "Save Note"}
        </button>
        <button onClick={resetForm} className="btn-cancel">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Notes App</h1>
      </header>
      <main className="app-main">
        <div className="content-container">
          {renderNotesList()}
          <div className="content-right">
            {isEditing ? renderNoteForm() : renderNoteView()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
