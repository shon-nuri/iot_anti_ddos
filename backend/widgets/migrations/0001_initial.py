# Generated by Django 5.2 on 2025-05-02 13:14

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Widget',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=50)),
                ('wtype', models.CharField(choices=[('light', 'Light'), ('door', 'Door'), ('alarm', 'Alarm'), ('temp', 'Temperature')], max_length=10)),
                ('config', models.JSONField(default=dict)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='WidgetLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('event', models.CharField(max_length=100)),
                ('widget', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='widgets.widget')),
            ],
        ),
    ]
