from flask import Flask
from flask import render_template
from flask.ext.socketio import SocketIO, emit
from hashlib import sha256
import sys

app = Flask(__name__)
app.config['SECRET_KEY'] = 'replaceme'
app.config['ADMIN_URL'] = '/admin'
app.config['DEBUG'] = True

# Replace the above secrets and specify other overrides here, or alternatively,
# create a config.py file that has a configure(app) function that adds these.
try:
    import config
    config.configure(app)
except ImportError:
    pass

socketio = SocketIO(app)
admin_secret = app.config['SECRET_KEY'] + "ADMIN_SECRET"
app.config['ADMIN_SECRET'] = sha256(admin_secret.encode('utf-8')).hexdigest()

# eetvoorkeur relies completely on a run-time state. This means that the state
# is reset whenever the app is restarted. Future versions might rely on a
# database of some kind, but for now, this was the easiest prototype.
state = {"step": 1,
         "options": [{'name': 'Albert Heijn', 'votes': 0},
                     {'name': 'De Fest', 'votes': 0},
                     {'name': 'Lotus', 'votes': 0},
                     ],
         "deadlines": ["16:00", "17:00", "18:15"],
         }


@app.route('/')
def index(admin=False):
    return render_template('index.html', admin=admin, state=state)


@app.route(app.config['ADMIN_URL'])
def admin():
    return index(admin=app.config['ADMIN_SECRET'])


@socketio.on('state update')
def update_state(message):
    if ('admin_secret' not in message or
            message['admin_secret'] != app.config['ADMIN_SECRET']):
        return
    if state['step'] == 0 and 'deadlines' in message:
        state['step'] = 1
        state['deadlines'] = message['deadlines']
    emit('state change', state, broadcast=True)


@socketio.on('vote')
def vote(message):
    if 'option' in message and message['option'] < len(state['options']):
        state['options'][message['option']]['votes'] += 1
        emit('state change', state, broadcast=True)


@socketio.on('new option')
def new_option(message):
    if ('newoption' in message and
            message['newoption'] not in [x['name'] for x in state['options']]):
        state['options'].append({'name': message['newoption'], 'votes': 0})
        emit('state change', state, broadcast=True)


app.run(debug=True, threaded=True)
