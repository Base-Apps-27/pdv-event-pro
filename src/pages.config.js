/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ActivityLog from './pages/ActivityLog';
import AnnouncementsReport from './pages/AnnouncementsReport';
import BuildMemory from './pages/BuildMemory';
import Calendar from './pages/Calendar';
import CustomServiceBuilder from './pages/CustomServiceBuilder';
import CustomServicesManager from './pages/CustomServicesManager';
import Dashboard from './pages/Dashboard';
import DataFlowMap from './pages/DataFlowMap';
import DataSeeder from './pages/DataSeeder';
import DependencyTracker from './pages/DependencyTracker';
import DetailedProgram from './pages/DetailedProgram';
import DirectorConsole from './pages/DirectorConsole';
import EventDetail from './pages/EventDetail';
import Events from './pages/Events';
import GeneralProgram from './pages/GeneralProgram';
import Home from './pages/Home';
import MessageProcessing from './pages/MessageProcessing';
import MyProgram from './pages/MyProgram';
import People from './pages/People';
import ProjectionView from './pages/ProjectionView';
import PublicCountdownDisplay from './pages/PublicCountdownDisplay';
import PublicProgramView from './pages/PublicProgramView';
import Reports from './pages/Reports';
import RolePermissionManager from './pages/RolePermissionManager';
import Rooms from './pages/Rooms';
import ScheduleImporter from './pages/ScheduleImporter';
import SchemaGuide from './pages/SchemaGuide';
import ServiceAnnouncementBuilder from './pages/ServiceAnnouncementBuilder';
import ServiceBlueprints from './pages/ServiceBlueprints';
import ServiceDetail from './pages/ServiceDetail';
import ServiceQuickEditor from './pages/ServiceQuickEditor';
import Services from './pages/Services';
import SessionDetail from './pages/SessionDetail';
import SoundView from './pages/SoundView';
import Teams from './pages/Teams';
import Templates from './pages/Templates';
import TestDashboard from './pages/TestDashboard';
import UserManagement from './pages/UserManagement';
import UshersView from './pages/UshersView';
import WeeklyServiceManager from './pages/WeeklyServiceManager';
import WeeklyServiceReport from './pages/WeeklyServiceReport';
import PublicSpeakerForm from './pages/PublicSpeakerForm';
import PublicArtsForm from './pages/PublicArtsForm';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ActivityLog": ActivityLog,
    "AnnouncementsReport": AnnouncementsReport,
    "BuildMemory": BuildMemory,
    "Calendar": Calendar,
    "CustomServiceBuilder": CustomServiceBuilder,
    "CustomServicesManager": CustomServicesManager,
    "Dashboard": Dashboard,
    "DataFlowMap": DataFlowMap,
    "DataSeeder": DataSeeder,
    "DependencyTracker": DependencyTracker,
    "DetailedProgram": DetailedProgram,
    "DirectorConsole": DirectorConsole,
    "EventDetail": EventDetail,
    "Events": Events,
    "GeneralProgram": GeneralProgram,
    "Home": Home,
    "MessageProcessing": MessageProcessing,
    "MyProgram": MyProgram,
    "People": People,
    "ProjectionView": ProjectionView,
    "PublicCountdownDisplay": PublicCountdownDisplay,
    "PublicProgramView": PublicProgramView,
    "Reports": Reports,
    "RolePermissionManager": RolePermissionManager,
    "Rooms": Rooms,
    "ScheduleImporter": ScheduleImporter,
    "SchemaGuide": SchemaGuide,
    "ServiceAnnouncementBuilder": ServiceAnnouncementBuilder,
    "ServiceBlueprints": ServiceBlueprints,
    "ServiceDetail": ServiceDetail,
    "ServiceQuickEditor": ServiceQuickEditor,
    "Services": Services,
    "SessionDetail": SessionDetail,
    "SoundView": SoundView,
    "Teams": Teams,
    "Templates": Templates,
    "TestDashboard": TestDashboard,
    "UserManagement": UserManagement,
    "UshersView": UshersView,
    "WeeklyServiceManager": WeeklyServiceManager,
    "WeeklyServiceReport": WeeklyServiceReport,
    "PublicSpeakerForm": PublicSpeakerForm,
    "PublicArtsForm": PublicArtsForm,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};