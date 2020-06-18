import React from 'react';
import Game from './pages/game';
import Leaderboard from './pages/leaderboard';
import Header from './components/header';

import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route
} from "react-router-dom";

class App extends React.Component {
  render() {
    return (
      <Router>
        <div>
          <Header/>
          <Switch>
            <Route exact path="/">
              <Game/>
            </Route>
            <Route path="/leaderboard">
              <Leaderboard />
            </Route>
          </Switch>
        </div>
      </Router>
    );
  }
}

export default App;
