from datetime import date
from collections import defaultdict
import os.path
from csv_utils import csv_records, csv_record_str
from csv import DictReader


def generate_data_set(authorizations, purpose):
    if authorizations is not None:
        authorized_fields_of_customer = {}
        for authorization in authorizations:
            customer_id = authorization['id']
            authorized_fields = authorization['authorized_fields']
            authorized_fields_of_customer[customer_id] = authorized_fields

    diseases_of_customer = {}
    prescription_ids_of_customer = {}
    customer_id_by_insurance_member_id = {}
    result = []
    for record in csv_records('all.csv'):
        customer_id = record['id']
        include_diseases = False
        include_prescriptions = False
        if authorizations is not None:
            authorized_fields = authorized_fields_of_customer.get(
                    customer_id, None)
            if authorized_fields is None:
                continue
        if purpose == 'marketing_deid':
            data = {'id': customer_id}
            result.append(data)
            data['zip'] = record['zip']
            data['gender'] = record['gender']
            data['age_group'] = age_group_from_dob_str(
                    record['dob'])
            include_diseases = True
            include_prescriptions = True
        elif purpose == 'individual_req':
            # The individual is requesting all of his/her own information.
            result.append(dict(record))
            include_diseases = True
            include_prescriptions = True
        else:
            data = {'id': customer_id}
            result.append(data)
            for field in authorized_fields.split('+'):
                if field == 'age':
                    data[field] = age_from_dob_str(record['dob'])
                elif field == 'diseases':
                    include_diseases = True
                elif field == 'prescriptions':
                    include_prescriptions = True
                elif field == 'aggregation':
                    pass
                else:
                    data[field] = record[field]

        if include_diseases or include_prescriptions:
            im_id = record['insurance_member_id']
            customer_id_by_insurance_member_id[im_id] = customer_id
        if include_diseases:
            diseases_of_customer[customer_id] = set()
        if include_prescriptions:
            prescription_ids_of_customer[customer_id] = set()

    customers_with_health = set()
    customer_id_by_insurance_id = {}
    for record in csv_records('insurance_company.csv'):
        im_id = record['insurance_member_id']
        customer_id = customer_id_by_insurance_member_id.get(im_id, None)
        if customer_id is not None:
            customer_id_by_insurance_id[record['insurance_id']] = customer_id
            customers_with_health.add(customer_id)

    if authorizations is None:
        result = filter(lambda x: x['id'] in customers_with_health, result)
        result = remove_identifiable_individuals(result)

    disease_name = {}
    for record in csv_records('disease_id.csv'):
        disease_name[record['disease_id']] = record['disease_name']

    prescription_by_id = {}
    for record in csv_records('prescriptions.csv'):
        pid = record['perscription_id']
        prescription_by_id[pid] = record

    for record in csv_records('insurance_health.csv'):
        insurance_id = record['insurance_id']

        customer_id = customer_id_by_insurance_id.get(insurance_id, None)
        if customer_id is not None:
            disease = disease_name[record['disease_id']]
            diseases_of_customer[customer_id].add(disease)
            pid = record['perscription_id']
            prescription_ids_of_customer[customer_id].add(pid)

    for customer in result:
        customer_id = customer['id']
        del customer['id']
        diseases = diseases_of_customer.get(customer_id, None)
        if diseases is not None:
            customer['diseases'] = '|'.join(diseases)
        pids = prescription_ids_of_customer.get(customer_id, None)
        if pids is not None:
            prescriptions = [prescription_by_id[pid] for pid in pids]
            customer['prescription_marketing_names'] = '|'.join(
                    (p['marketing_name'] for p in prescriptions))
            if purpose == 'individual_req':
                customer['prescription_chemical_names'] = '|'.join(
                        (p['chemical_name'] for p in prescriptions))
                customer['prescription_probabilities'] = '|'.join(
                        (p['perscription_probability'] for p in prescriptions))
    return result


def csv_from_generated_data(customers):
    keys = set()
    for customer in customers:
        keys.update(customer.keys())

    if not customers:
        return csv_record_str(["Error: No data available."]) + "\r\n"
    if not keys:
        return csv_record_str([
                "We are not sharing any identifiable information about you " +
                "due to your sharing settings."]) + "\r\n"
    keys = sorted(keys)
    csv = csv_record_str(keys) + "\r\n"
    for customer in customers:
        csv += csv_record_str((customer.get(k, '') for k in keys)) + "\r\n"
    return csv


def age_from_dob_str(dob_str):
    today = date.today()
    year, month, day = dob_str.split('-')
    age = today.year - int(year)
    if (today.month, today.day) < (int(month), int(day)):
        age -= 1
    return age


def age_group_from_dob_str(dob_str):
    age = age_from_dob_str(dob_str)
    group = age // 10 * 10
    if group == 80:
        return '>79'
    return str(group) + '-' + str(group + 9)


def remove_identifiable_individuals(customers, anonymity=20):
    my_dir = os.path.dirname(os.path.realpath(__file__))
    full_path = os.path.join(my_dir, 'Population_By_Zipcode.csv')
    age_groups_by_zip = defaultdict(lambda: {})
    with open(full_path, 'r', newline='\r\n') as f:
        for row in DictReader(f):
            groups = age_groups_by_zip[row['zip_x']]
            for (key, value) in row.items():
                if key != 'zip_x' and key != '2010 Census Population':
                    groups[key] = int(value)

    result = []
    for customer in customers:
        groups = age_groups_by_zip.get(customer['zip'], {})
        count = groups.get(customer['age_group'], 0)
        if count >= anonymity:
            result.append(customer)

    return result
