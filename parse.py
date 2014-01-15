from __future__ import print_function
from datetime import datetime
from bisect import bisect_left, bisect_right
import csv
import itertools
import numpy
import scipy
import scipy.interpolate


class Row(object):
    def __init__(self, x, y, date):
        self.data = []
        self.day = date.day
        self.x = x
        self.y = y


def load_var(x, y, data, points, depth):
    values = data[:, :, depth]
    for p in points:
        hx_index = bisect_left(x, p.x)
        lx_index  = hx_index - 1
        hy_index = bisect_left(y, p.y)
        ly_index  = hy_index - 1

        hx = x[hx_index]
        lx = x[lx_index]
        hy = y[hy_index]
        ly = y[ly_index]

        ur_value = values[hx_index, hy_index]
        ul_value = values[lx_index , hy_index]
        lr_value = values[hx_index, ly_index]
        ll_value = values[lx_index , ly_index]

        l_value = (lr_value - ll_value)/(hx - lx)*(p.x - lx) + ll_value
        u_value = (ur_value - ul_value)/(hx - lx)*(p.x - lx) + ul_value
        p_value = (u_value - l_value)/(hy - ly)*(p.y - ly) + l_value

        p.data.append(float(p_value))


def load_row(row):
    y, x = float(row[8]), float(row[9])
    cpue = float(row[41])
    date = datetime.strptime(row[5], '%Y/%m/%d %H:%M')
    o = Row(x, y, date)
    o.data.append(cpue)
    return o


def load_grid(filename):
    rows = open(filename).readlines()[4:-4]
    data = ''.join(rows).split()
    it = iter(data)
    next(it)
    xn = int(next(it))
    next(it)
    x = [float(next(it)) for _ in range(xn)]
    next(it)
    yn = int(next(it))
    next(it)
    y = [float(next(it)) for _ in range(yn)]
    next(it)
    zn = int(next(it))
    next(it)
    z = [float(next(it)) for _ in range(zn)]
    return x, y, z


def main():
    variables = ['S', 'T', 'U', 'V', 'W']
    depths = range(0, 54, 10)
    labels = ['cpue']
    rows = list(csv.reader(open('cpue.csv')))
    data = [load_row(row) for row in rows[1:]]
    x, y, _ = load_grid('S/S3D_intpo.ctl')
    for day, points in itertools.groupby(data, lambda o: o.day):
        points = list(points)
        for v in variables:
            fname = '{0}/{0}3D_intpo.200601{1:02}'.format(v, day)
            values = numpy.fromfile(fname, '>f4')
            values.shape = (673, 442, 54)
            for depth in depths:
                label = '200601{0}-{1}-{2}'.format(day, v, depth)
                print(label)
                load_var(x, y, values, points, depth)
    labels.extend('{0}{1}'.format(v, d) for v in variables for d in depths)
    print([row.data for row in data])
    writer = csv.writer(open('cpue-var.csv', 'w'))
    writer.writerow(labels)
    writer.writerows([row.data for row in data])


if __name__ == '__main__':
    main()
