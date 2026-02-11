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
import AnnouncementsReport from './pages/AnnouncementsReport';
import BuildMemory from './pages/BuildMemory';
import CustomServiceBuilder from './pages/CustomServiceBuilder';
import CustomServicesManager from './pages/CustomServicesManager';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import Events from './pages/Events';
import Home from './pages/Home';
import MessageProcessing from './pages/MessageProcessing';
import People from './pages/People';
import PublicCountdownDisplay from './pages/PublicCountdownDisplay';
import PublicProgramView from './pages/PublicProgramView';
import Reports from './pages/Reports';
import RolePermissionManager from './pages/RolePermissionManager';
import Rooms from './pages/Rooms';
import ScheduleImporter from './pages/ScheduleImporter';
import SchemaGuide from './pages/SchemaGuide';
import SessionDetail from './pages/SessionDetail';
import Templates from './pages/Templates';
import TestDashboard from './pages/TestDashboard';
import UserManagement from './pages/UserManagement';
import WeeklyServiceManager from './pages/WeeklyServiceManager';
import WeeklyServiceReport from './pages/WeeklyServiceReport';
import DirectorConsole from './pages/DirectorConsole';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AnnouncementsReport": AnnouncementsReport,
    "BuildMemory": BuildMemory,
    "CustomServiceBuilder": CustomServiceBuilder,
    "CustomServicesManager": CustomServicesManager,
    "Dashboard": Dashboard,
    "EventDetail": EventDetail,
    "Events": Events,
    "Home": Home,
    "MessageProcessing": MessageProcessing,
    "People": People,
    "PublicCountdownDisplay": PublicCountdownDisplay,
    "PublicProgramView": PublicProgramView,
    "Reports": Reports,
    "RolePermissionManager": RolePermissionManager,
    "Rooms": Rooms,
    "ScheduleImporter": ScheduleImporter,
    "SchemaGuide": SchemaGuide,
    "SessionDetail": SessionDetail,
    "Templates": Templates,
    "TestDashboard": TestDashboard,
    "UserManagement": UserManagement,
    "WeeklyServiceManager": WeeklyServiceManager,
    "WeeklyServiceReport": WeeklyServiceReport,
    "DirectorConsole": DirectorConsole,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};