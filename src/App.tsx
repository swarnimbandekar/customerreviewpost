import { useState, useEffect } from 'react';
import ComplaintForm from './components/ComplaintForm';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePathChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePathChange);

    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      handlePathChange();
    };

    return () => {
      window.removeEventListener('popstate', handlePathChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  if (currentPath === '/admin') {
    return <AdminDashboard />;
  }

  return <ComplaintForm />;
}

export default App;
