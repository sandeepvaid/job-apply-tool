import React, { useEffect, useRef, useState } from 'react';
import JobsTab from './components/JobsTab.jsx';
import AppliedTab from './components/AppliedTab.jsx';
import NotesTab from './components/NotesTab.jsx';
import ResumesTab from './components/ResumesTab.jsx';
import EditorTab from './components/EditorTab.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import { api } from './api.js';

const TABS = [
  ['jobs', 'Jobs'],
  ['applied', 'Applied'],
  ['notes', 'Job Notes'],
  ['resumes', 'Resumes'],
  ['editor', 'Resume Editor'],
  ['profile', 'Profile & Answers'],
];

export default function App() {
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'jobs');
  const [profile, setProfile] = useState(null);
  const headerRef = useRef(null);

  useEffect(() => { api.getProfile().then(setProfile); }, []);
  useEffect(() => { history.replaceState(null, '', '#' + tab); }, [tab]);
  // expose the header's real height as a CSS var so sticky filter bars can
  // pin themselves right below it instead of overlapping
  useEffect(() => {
    const setH = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty('--header-h', headerRef.current.offsetHeight + 'px');
      }
    };
    setH();
    window.addEventListener('resize', setH);
    return () => window.removeEventListener('resize', setH);
  }, []);

  return (
    <>
      <header ref={headerRef}>
        <h1>Job Finder — Apply</h1>
        {TABS.map(([id, label]) => (
          <span key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            {label}
          </span>
        ))}
      </header>
      <main>
        {tab === 'jobs' && <JobsTab profile={profile} />}
        {tab === 'applied' && <AppliedTab />}
        {tab === 'notes' && <NotesTab />}
        {tab === 'resumes' && <ResumesTab />}
        {tab === 'editor' && <EditorTab />}
        {tab === 'profile' && <ProfileTab profile={profile} onSaved={setProfile} />}
      </main>
    </>
  );
}
