import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import SessionDetail from './pages/SessionDetail';
import Templates from './pages/Templates';
import People from './pages/People';
import Rooms from './pages/Rooms';
import Teams from './pages/Teams';
import Reports from './pages/Reports';
import PublicProgramView from './pages/PublicProgramView';
import Calendar from './pages/Calendar';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Events": Events,
    "EventDetail": EventDetail,
    "SessionDetail": SessionDetail,
    "Templates": Templates,
    "People": People,
    "Rooms": Rooms,
    "Teams": Teams,
    "Reports": Reports,
    "PublicProgramView": PublicProgramView,
    "Calendar": Calendar,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};