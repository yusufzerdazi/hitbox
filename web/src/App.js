import { Provider } from 'react-redux';
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { PlayFabClient } from 'playfab-sdk';

import React from 'react';
import Game from './pages/game';
import Leaderboard from './pages/leaderboard';
import Instructions from './pages/instructions';
import Options from './components/options';
import Footer from './components/footer';
import Scores from './components/scores';
import { store } from './redux/store';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

PlayFabClient.settings.titleId = "5B7C3";

class App extends React.Component {
  constructor(props){
    super(props);
    this.state = {showGui: true};
    this.toggleGui = this.toggleGui.bind(this);
  }

  toggleGui(showGui){
    this.setState({showGui: showGui});
  }

  render() {
    return (
      <Provider store={store}>
        <Router>
          <Switch>
            <Route exact path="/">
              <Game toggleGui={this.toggleGui}/>
            </Route>
            <Route exact path="/leaderboard">
              <Leaderboard />
            </Route>
            <Route exact path="/instructions">
              <Instructions />
            </Route>
          </Switch>
          <div className="options" style={{display: this.state.showGui ? 'block' : 'none'}}>
            <Scores/>
            <Options/>
          </div>
          { this.state.showGui ? 
          <Footer/> : <></> }
        </Router>
      </Provider>
    );
  }
}

export default App;
