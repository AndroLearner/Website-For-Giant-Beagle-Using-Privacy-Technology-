from threading import Lock
import os.path
from csv import DictReader


def csv_quote(field):
    return '"' + str(field).replace('"', '""') + '"'


def csv_record_str(fields):
    return ';'.join(map(csv_quote, fields))


def get_db_file_path(filename):
    my_dir = os.path.dirname(os.path.realpath(__file__))
    if filename.startswith('hc_'):
        db_path = 'hc-database'
    else:
        db_path = 'customer-database'
    return os.path.join(my_dir, db_path, filename)


csv_lock = Lock()


def csv_append(filename, data_dict):
    full_path = get_db_file_path(filename)
    with csv_lock:
        with open(full_path, 'a', newline='\r\n') as f:
            keys = sorted(data_dict.keys())
            if f.tell() == 0:
                # New file, write headers.
                f.write(csv_record_str(keys) + '\n')
            fields = map(lambda k: data_dict[k], keys)
            f.write(csv_record_str(fields) + '\n')


def csv_records(filename):
    full_path = get_db_file_path(filename)
    with csv_lock:
        try:
            with open(full_path, 'r', newline='\r\n') as f:
                csvreader = DictReader(f, delimiter=';', quotechar='"')
                yield from csvreader
        except FileNotFoundError:
            return []
