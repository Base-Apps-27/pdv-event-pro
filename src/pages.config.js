import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import SessionDetail from './pages/SessionDetail';
import Templates from './pages/Templates';
import Rooms from './pages/Rooms';
import Reports from './pages/Reports';
import PublicProgramView from './pages/PublicProgramView';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import AnnouncementsReport from './pages/AnnouncementsReport';
import People from './pages/People';
import ScheduleImporter from './pages/ScheduleImporter';
import SchemaGuide from './pages/SchemaGuide';
import ServiceAnnouncementBuilder from './pages/ServiceAnnouncementBuilder';
import ServiceQuickEditor from './pages/ServiceQuickEditor';
import WeeklyServiceManager from './pages/WeeklyServiceManager';
import CustomServiceBuilder from './pages/CustomServiceBuilder';
import WeeklyServiceReport from './pages/WeeklyServiceReport';
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
    "Services": Services,
    "ServiceDetail": ServiceDetail,
    "AnnouncementsReport": AnnouncementsReport,
    "People": People,
    "ScheduleImporter": ScheduleImporter,
    "SchemaGuide": SchemaGuide,
    "ServiceAnnouncementBuilder": ServiceAnnouncementBuilder,
    "ServiceQuickEditor": ServiceQuickEditor,
    "WeeklyServiceManager": WeeklyServiceManager,
    "CustomServiceBuilder": CustomServiceBuilder,
    "WeeklyServiceReport": WeeklyServiceReport,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};