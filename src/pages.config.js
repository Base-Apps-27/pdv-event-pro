import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import SessionDetail from './pages/SessionDetail';
import GeneralProgram from './pages/GeneralProgram';
import ProjectionView from './pages/ProjectionView';
import SoundView from './pages/SoundView';
import UshersView from './pages/UshersView';
import Templates from './pages/Templates';
import DetailedProgram from './pages/DetailedProgram';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Events": Events,
    "EventDetail": EventDetail,
    "SessionDetail": SessionDetail,
    "GeneralProgram": GeneralProgram,
    "ProjectionView": ProjectionView,
    "SoundView": SoundView,
    "UshersView": UshersView,
    "Templates": Templates,
    "DetailedProgram": DetailedProgram,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};