
import React from 'react';
import styles from './styles.module.css';
import xmlToJSON from 'xmltojson';
import { Container, Row, Col } from 'react-bootstrap';
import Utils from '../../utils';

class Avatars extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
  }

  componentDidMount(){
    fetch("https://hitbox.blob.core.windows.net/options?restype=container&comp=list")
      .then(response => {
        response.text().then(xml => {
          var json = xmlToJSON.parseString(xml);
          var blobs = json.EnumerationResults[0].Blobs[0].Blob;
          var urls = [];
          blobs.forEach(blob => {
            urls.push({
              url: blob.Url[0]._text,
              title: Utils.getFilename(blob.Url[0]._text)
            });
          });
          this.setState({blobs: urls});
        });
      })
  }

  selectAvatar(option){
    fetch(`${process.env.REACT_APP_FUNCTION_URL}/api/SelectAvatar/${this.props.playerId}?option=${encodeURIComponent(option)}&code=eBvuZ/g3HtoMqsreW6JpIYeYTOfvxiATIlM8q4l3wwMF/ogBFa3dXw==`)
    .then((response) => response.json())
    .then((json) => {
      this.props.onChange(json.url)
    });
  }

  render() {
    return (
      <div className={styles.avatarContainer}>
        <Container>
          <Row xs={3}>
            { this.state.blobs ? this.state.blobs.map((blob, i) => {
              return <Col key={i}>
                  <img onClick={() => this.selectAvatar(blob.title)} className={styles.avatar} src={blob.url} />
                </Col>
            }) : <Col></Col>}
          </Row>
        </Container>
      </div>
    );
  }
}

export default Avatars;