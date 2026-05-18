import { lazy } from 'react';
import __Layout from './Layout.jsx';

export const PAGES = {
  AddEventToWristband: lazy(() => import('./pages/AddEventToWristband')),
  AddTask:             lazy(() => import('./pages/AddTask')),
  AgentGroups:         lazy(() => import('./pages/AgentGroups')),
  AllExpenses:         lazy(() => import('./pages/AllExpenses')),
  BankTable:           lazy(() => import('./pages/BankTable')),
  CasparFilling:       lazy(() => import('./pages/CasparFilling')),
  Caspars:             lazy(() => import('./pages/Caspars')),
  CreateExpense:       lazy(() => import('./pages/CreateExpense')),
  EventScanner:        lazy(() => import('./pages/EventScanner')),
  EventsAndAttractions:lazy(() => import('./pages/EventsAndAttractions')),
  EventStats:          lazy(() => import('./pages/EventStats')),
  Live:                lazy(() => import('./pages/Live')),
  ManagerDashboard:    lazy(() => import('./pages/ManagerDashboard')),
  MyOrder:             lazy(() => import('./pages/MyOrder')),
  NewSale:             lazy(() => import('./pages/NewSale')),
  OrderDetails:        lazy(() => import('./pages/OrderDetails')),
  OrderSuccess:        lazy(() => import('./pages/OrderSuccess')),
  PendingSales:        lazy(() => import('./pages/PendingSales')),
  ReturnedToIsrael:    lazy(() => import('./pages/ReturnedToIsrael')),
  SalesRepDashboard:   lazy(() => import('./pages/SalesRepDashboard')),
  SavedData:           lazy(() => import('./pages/SavedData')),
  SellerDashboard:     lazy(() => import('./pages/SellerDashboard')),
  SubmitReceipt:       lazy(() => import('./pages/SubmitReceipt')),
  SwapWristband:       lazy(() => import('./pages/SwapWristband')),
  Table:               lazy(() => import('./pages/Table')),
  TaskSentSuccess:     lazy(() => import('./pages/TaskSentSuccess')),
  Tasks:               lazy(() => import('./pages/Tasks')),
  UserApproval:        lazy(() => import('./pages/UserApproval')),
  WristbandHistory:    lazy(() => import('./pages/WristbandHistory')),
};

export const pagesConfig = {
  mainPage: 'Table',
  Pages: PAGES,
  Layout: __Layout,
};
