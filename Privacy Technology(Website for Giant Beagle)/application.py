from uuid import uuid4
from flask import Flask, jsonify, request, url_for, redirect, make_response
from werkzeug.exceptions import Forbidden
from datetime import datetime, date
from isodate import datetime_isoformat, UTC
import hashlib
import os
from zipfile import ZipFile

from csv_utils import csv_append, csv_records
from data_generation import generate_data_set, csv_from_generated_data

app = Flask(__name__)


def find_customer_id(firstname, lastname, dob):
    firstname = firstname.upper()
    lastname = lastname.upper()
    for record in csv_records('all.csv'):
        if (record['firstname'] == firstname and
                record['lastname'] == lastname and
                record['dob'] == dob):
            return record['id']
    return None


def last_authorization_by_customer(customer_id):
    result = None
    for record in csv_records('hc_authorization.csv'):
        if record['id'] == customer_id:
            result = record
    return result


def find_authorization_by_token(token):
    for record in csv_records('hc_authorization.csv'):
        if record['token'] == token:
            return record
    return None


def find_customer_record(customer_id):
    for record in csv_records('all.csv'):
        if record['id'] == customer_id:
            return record
    return None


def age_from_dob_str(dob_str):
    today = date.today()
    year, month, day = dob_str.split('-')
    age = today.year - int(year)
    if (today.month, today.day) < (int(month), int(day)):
        age -= 1
    return age


def authenticate_customer(request, auto_register=False):
    if isinstance(request, str):
        token = request
    else:
        token = request.json.get('authorization_token', None)
    if token:
        authorization = find_authorization_by_token(token)
        if authorization is None:
            raise Forbidden()
        return authorization
    else:
        firstname = request.json['firstname']
        lastname = request.json['lastname']
        dob = request.json['dob']
        customer_id = find_customer_id(firstname, lastname, dob)
        if customer_id is None:
            raise Forbidden()
        password = request.json['password']
        authorization = last_authorization_by_customer(customer_id)
        if not authorization and not auto_register:
            raise Forbidden()
        auth_hash = compute_auth_hash(customer_id, password)
        if authorization:
            if authorization['auth_hash'] != auth_hash:
                raise Forbidden()
            return dict(authorization)
        else:
            return {'auth_hash': auth_hash, 'id': customer_id}


@app.errorhandler(Forbidden)
def handle_invalid_usage(error):
    response = jsonify({'error': 'forbidden'})
    response.status_code = 403
    return response


def compute_auth_hash(customer_id, password):
    # This isn't quite secure because it is too fast. We can use bcrypt later.
    secret = 'CVH1uwT+jiY34NZong7snzmKjghtY5MZC4mJYAheDbZAD01Z'
    source = '$'.join([secret, customer_id, password])
    return hashlib.sha512(source.encode('utf-8')).hexdigest()


@app.route('/', methods=['GET'])
def homepage_redirect():
    return redirect(url_for('static', filename='index.html'))


@app.route('/authorization', methods=['POST'])
def authorization():
    authorization = authenticate_customer(request, auto_register=True)
    authorization['token'] = str(uuid4())
    authorization['created_at'] = datetime_isoformat(datetime.now(UTC))
    authorization['authorized_fields'] = request.json['authorized_fields']
    csv_append('hc_authorization.csv', authorization)
    del authorization['auth_hash']

    for record in csv_records('all.csv'):
        if record['id'] == authorization['id']:
            authorization['customer'] = {
                'firstname': record['firstname'],
                'lastname': record['lastname'],
            }
    return jsonify(authorization)


@app.route('/authorization', methods=['GET'])
def authorization_list():
    customer_by_id = {}
    for record in csv_records('all.csv'):
        customer_by_id[record['id']] = {
            'firstname': record['firstname'],
            'lastname': record['lastname'],
            'dob': record['dob'],
            'age': age_from_dob_str(record['dob']),
            'address': record['address'],
        }
    result = []
    for record in csv_records('hc_authorization.csv'):
        record = dict(record)
        del record['token']
        del record['auth_hash']
        record['customer'] = customer_by_id[record['id']]
        result.append(record)
    return jsonify(result)


@app.route('/customers/query', methods=['POST'])
def customers_query():
    firstname = request.json['firstname']
    lastname = request.json['lastname']
    dob = request.json['dob']
    customer_id = find_customer_id(firstname, lastname, dob)
    if customer_id is None:
        return jsonify({'exists': False})
    authroization = last_authorization_by_customer(customer_id)
    authorized = (authroization is not None)
    return jsonify({'exists': True, 'authorized': authorized})


@app.route('/authorization/query', methods=['POST'])
def authorization_query():
    authorization = authenticate_customer(request)

    for record in csv_records('all.csv'):
        if record['id'] == authorization['id']:
            authorization['customer'] = {
                'firstname': record['firstname'],
                'lastname': record['lastname'],
            }
    del authorization['auth_hash']
    return jsonify(authorization)


@app.route('/complaints', methods=['POST'])
def complaint_create():
    authorization = authenticate_customer(request)

    complaint = {
        'complaint_id': str(uuid4()),
        'customer_id': authorization['id'],
        'email': request.json['email'],
        'created_at': datetime_isoformat(datetime.now(UTC)),
        'complaint_type': request.json['complaint_type'],
        'complaint_details': request.json['complaint_details'],
        'desired_outcome': request.json['desired_outcome'],
        'incident_date': request.json['incident_date'],
        'signature': request.json['signature'],
    }
    csv_append('hc_complaint.csv', complaint)
    return jsonify(complaint)


@app.route('/complaints', methods=['GET'])
def complaint_list():
    customer_by_id = {}
    for record in csv_records('all.csv'):
        customer_by_id[record['id']] = {
            'firstname': record['firstname'],
            'lastname': record['lastname'],
            'dob': record['dob'],
            'address': record['address'],
        }
    result = []
    for record in csv_records('hc_complaint.csv'):
        record = dict(record)
        record['customer'] = customer_by_id[record['customer_id']]
        result.append(record)
    return jsonify(result)


@app.route('/download/phi', methods=['GET'])
def download_phi():
    authorization = authenticate_customer(request.args['token'])

    dataset = generate_data_set([authorization], 'individual_req')
    csv = csv_from_generated_data(dataset)
    response = make_response(csv)
    cd = 'attachment; filename=my-phi.csv'
    response.headers['Content-Disposition'] = cd
    response.mimetype = 'text/csv'
    return response


@app.route('/download/generated_data', methods=['GET'])
def download_generated_data():
    authorization = authenticate_customer(request.args['token'])

    dataset = generate_data_set([authorization], 'marketing')
    csv = csv_from_generated_data(dataset)
    response = make_response(csv)
    cd = 'attachment; filename=generated_data.csv'
    response.headers['Content-Disposition'] = cd
    response.mimetype = 'text/csv'
    return response


@app.route('/download/generated_data_deid', methods=['GET'])
def download_generated_data_deid():
    authorization = authenticate_customer(request.args['token'])

    dataset = generate_data_set([authorization], 'marketing_deid')
    csv = csv_from_generated_data(dataset)
    response = make_response(csv)
    cd = 'attachment; filename=generated_data_deid.csv'
    response.headers['Content-Disposition'] = cd
    response.mimetype = 'text/csv'
    return response


def export_data():
    export_id = str(uuid4())
    filename = export_id + '.zip'
    my_dir = os.path.dirname(os.path.realpath(__file__))
    full_path = os.path.join(my_dir, 'static', 'export', filename)

    with ZipFile(full_path, 'w') as myzip:
        auth_dataset = generate_data_set(
                csv_records('hc_authorization.csv'), 'marketing')
        id_rows = len(auth_dataset)
        auth_csv = csv_from_generated_data(auth_dataset)
        myzip.writestr('authorized_identifiable.csv', auth_csv)

        deid_dataset = generate_data_set(None, 'marketing_deid')
        deid_rows = len(deid_dataset)
        deid_csv = csv_from_generated_data(deid_dataset)
        myzip.writestr('deidentified_data.csv', deid_csv)

    return {
        'export_id': export_id,
        'created_at': datetime_isoformat(datetime.now(UTC)),
        'id_rows': id_rows,
        'deid_rows': deid_rows,
        'url': url_for('static', filename='export/' + filename)
    }


@app.route('/exports', methods=['POST'])
def export_create():
    purpose = request.json['purpose']
    partner = request.json['partner']
    export = export_data()
    export['purpose'] = purpose
    export['partner'] = partner

    csv_append('hc_export.csv', export)
    return jsonify(export)


@app.route('/exports', methods=['GET'])
def export_list():
    return jsonify(list(csv_records('hc_export.csv')))


if __name__ == "__main__":
    app.debug = True
    app.run()
