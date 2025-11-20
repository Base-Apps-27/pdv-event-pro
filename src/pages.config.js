import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import SessionDetail from './pages/SessionDetail';
import Templates from './pages/Templates';
import Rooms from './pages/Rooms';
import Reports from './pages/Reports';
import PublicProgramView from './pages/PublicProgramView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Events": Events,
    "EventDetail": EventDetail,
    "SessionDetail": SessionDetail,
    "Templates": Templates,
    "Rooms": Rooms,
    "Reports": Reports,
    "PublicProgramView": PublicProgramView,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};