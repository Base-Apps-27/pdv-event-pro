import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import SessionDetail from './pages/SessionDetail';
import GeneralProgram from './pages/GeneralProgram';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Events": Events,
    "EventDetail": EventDetail,
    "SessionDetail": SessionDetail,
    "GeneralProgram": GeneralProgram,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};