
import React from 'react';
import { connect } from "react-redux";
import DataTable from 'react-data-table-component';
import { store } from '../../redux/store';
import styles from './styles.module.css';

const mapStateToProps = state => {
  return {
    user: state.logIn.user
  }
};

const columns = [
  {
    name: 'Name',
    selector: 'name',
    sortable: true
  },
  {
    name: 'Wins',
    selector: 'wins',
    sortable: true,
    right: true
  },
  {
    name: 'Losses',
    selector: 'losses',
    sortable: true,
    right: true
  },
  {
    name: 'Win/Loss',
    selector: 'winloss',
    sortable: true,
    right: true
  }
];

class Leaderboard extends React.Component {
  constructor(props){
    super(props);
    this.getLeaderboard = this.getLeaderboard.bind(this);
    this.loadLeaderboards = this.loadLeaderboards.bind(this);
    this.state = {consolidatedLeaderboards: {}};
  }

  convertLeaderboardsToArray(){
    var leaderboardsArray = [];
    for (var key in this.state.consolidatedLeaderboards) {
      var value = this.state.consolidatedLeaderboards[key];
      value.name = key;
      leaderboardsArray.push(value);
    }
    return leaderboardsArray
  }

  getLeaderboard(name, tranformation = (x) => x){
    return window.PlayFabClientSDK.GetLeaderboard({
      MaxResultsCount: 100,
      StatisticName: name
    }).then(l => {
        var consolidatedLeaderboards = this.state.consolidatedLeaderboards;
        l.data.Leaderboard.forEach(row => {
          if(!consolidatedLeaderboards[row.DisplayName]){
            consolidatedLeaderboards[row.DisplayName] = {};
          }
          consolidatedLeaderboards[row.DisplayName][name] = tranformation(row.StatValue);
        })
        this.setState({consolidatedLeaderboards: consolidatedLeaderboards})
    });
  }

  loadLeaderboards(){
    var state = store.getState()
    if(state.logIn.user?.loggedIn){
      var p1 = this.getLeaderboard('wins');
      var p2 = this.getLeaderboard('losses');
      var p3 = this.getLeaderboard('winloss', (x) => x / 1000);
      Promise.all([p1, p2, p3]).then(() => {
        this.setState({leaderboardsArray:this.convertLeaderboardsToArray()});
      })
    }
  }

  componentDidMount() {
    this.loadLeaderboards()
    store.subscribe(() => {
      this.loadLeaderboards();
    })
  }

  render() {
    return (
      <div className={styles.tableContainer}>
        {this.state.leaderboardsArray ? <DataTable
          title="Leaderboard"
          columns={columns}
          data={this.state.leaderboardsArray}
        /> : null}
      </div>
    );
  }
}

export default connect(mapStateToProps, () => ({}))(Leaderboard);