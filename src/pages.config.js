import AnnouncementsReport from './pages/AnnouncementsReport';
import CustomServiceBuilder from './pages/CustomServiceBuilder';
import CustomServicesManager from './pages/CustomServicesManager';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import Events from './pages/Events';
import Home from './pages/Home';
import People from './pages/People';
import PublicProgramView from './pages/PublicProgramView';
import Reports from './pages/Reports';
import Rooms from './pages/Rooms';
import ScheduleImporter from './pages/ScheduleImporter';
import SchemaGuide from './pages/SchemaGuide';
import SessionDetail from './pages/SessionDetail';
import Templates from './pages/Templates';
import TestDashboard from './pages/TestDashboard';
import UserManagement from './pages/UserManagement';
import WeeklyServiceManager from './pages/WeeklyServiceManager';
import WeeklyServiceReport from './pages/WeeklyServiceReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AnnouncementsReport": AnnouncementsReport,
    "CustomServiceBuilder": CustomServiceBuilder,
    "CustomServicesManager": CustomServicesManager,
    "Dashboard": Dashboard,
    "EventDetail": EventDetail,
    "Events": Events,
    "Home": Home,
    "People": People,
    "PublicProgramView": PublicProgramView,
    "Reports": Reports,
    "Rooms": Rooms,
    "ScheduleImporter": ScheduleImporter,
    "SchemaGuide": SchemaGuide,
    "SessionDetail": SessionDetail,
    "Templates": Templates,
    "TestDashboard": TestDashboard,
    "UserManagement": UserManagement,
    "WeeklyServiceManager": WeeklyServiceManager,
    "WeeklyServiceReport": WeeklyServiceReport,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};