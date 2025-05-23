# Generated by Django 5.2 on 2025-04-30 13:13

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('devices', '0003_temperature'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='device',
            name='is_door_open',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='device',
            name='is_light_on',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='Threshold',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('metric', models.CharField(choices=[('temp', 'Температура'), ('errors', 'Ошибки')], max_length=20)),
                ('min_value', models.FloatField(blank=True, null=True)),
                ('max_value', models.FloatField(blank=True, null=True)),
                ('auto_block', models.BooleanField(default=False)),
                ('notify', models.BooleanField(default=True)),
                ('relay_control', models.BooleanField(default=False)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
