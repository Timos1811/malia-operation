import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        // Update document title based on path
        const path = location.pathname.replace(/^\//, '') || 'Home';
        document.title = path;
    }, [location]);

    return null;
}
